import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
import { validateSiret } from "@/lib/siret-validation"
import { getInseeToken } from "@/lib/insee-token"

// Nouvelle URL de l'API INSEE Sirene V3.11 (depuis portail-api.insee.fr)
const INSEE_SIRET_API_URL = "https://api.insee.fr/api-sirene/3.11/siret"

type SiretVerificationResponse = {
  exists: boolean
  siret: string
  raison_sociale?: string
  nom?: string
  prenom?: string
  statut_juridique?: string
  adresse?: {
    numero: string
    voie: string
    type_voie: string
    code_postal: string
    ville: string
  } | null
  error?: string
  unavailable?: boolean
}

type InseeSireneResponse = {
  etablissement?: {
    siret?: string
    denominationUsuelleEtablissement?: string
    enseigne1Etablissement?: string
    adresseEtablissement?: {
      numeroVoieEtablissement?: string
      typeVoieEtablissement?: string
      libelleVoieEtablissement?: string
      codePostalEtablissement?: string
      libelleCommuneEtablissement?: string
    }
    uniteLegale?: {
      denominationUniteLegale?: string
      nomUniteLegale?: string
      prenom1UniteLegale?: string
      libelleCategorieJuridiqueUniteLegale?: string
      categorieJuridiqueUniteLegale?: string
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siret = searchParams.get("siret")?.trim()

    // Validation du paramètre requis
    if (!siret || siret.length === 0) {
      return NextResponse.json(
        {
          exists: false,
          siret: "",
          error: "Le paramètre 'siret' est requis",
        } satisfies SiretVerificationResponse,
        { status: 400 }
      )
    }

    // Validation format + Luhn côté serveur
    const validation = validateSiret(siret)
    if (!validation.isValid) {
      return NextResponse.json(
        {
          exists: false,
          siret,
          error: validation.errorMessage,
        } satisfies SiretVerificationResponse,
        { status: 400 }
      )
    }

    // Nettoyer le SIRET (supprimer espaces)
    const cleanSiret = siret.replace(/\s/g, "")

    // Obtenir le token OAuth2 ou clé API
    let token: string
    try {
      token = await getInseeToken()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erreur lors de l'obtention du token d'authentification"
      console.error("[api/siret/verify] Erreur lors de l'obtention du token:", error)
      
      // Message d'erreur plus détaillé pour l'utilisateur
      let userMessage = "Service de vérification temporairement indisponible"
      if (message.includes("identifiants INSEE ne sont pas configurés")) {
        userMessage = "Configuration manquante : veuillez configurer INSEE_API_KEY (clé API simple) OU INSEE_CLIENT_ID et INSEE_CLIENT_SECRET (OAuth2) dans .env.local et redémarrer le serveur"
      } else if (message.includes("401") || message.includes("403")) {
        userMessage = "Identifiants INSEE incorrects. Vérifiez votre clé API ou vos identifiants sur https://api.insee.fr"
      } else if (message.includes("Échec de l'obtention du token")) {
        userMessage = `Erreur API INSEE : ${message}`
      }
      
      return NextResponse.json(
        {
          exists: false,
          siret: cleanSiret,
          error: userMessage,
          unavailable: true,
        } satisfies SiretVerificationResponse,
        { status: 503 }
      )
    }

    // Appeler l'API Sirene avec retry en cas d'erreur 401/403
    const result = await fetchSiretWithRetry(cleanSiret, token)

    if (result.error) {
      return NextResponse.json(result, {
        status: result.unavailable ? 503 : result.exists === false ? 404 : 500,
      })
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("[api/siret/verify] Erreur inattendue:", error)
    return NextResponse.json(
      {
        exists: false,
        siret: "",
        error: "Erreur lors de la vérification du SIRET",
        unavailable: false,
      } satisfies SiretVerificationResponse,
      { status: 500 }
    )
  }
}

async function fetchSiretWithRetry(
  siret: string,
  token: string
): Promise<SiretVerificationResponse> {
  const maxRetries = 1
  let currentToken = token
  let lastError: SiretVerificationResponse | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Préparer les headers selon le type d'authentification
      // Pour les clés API simples du nouveau portail, utiliser X-INSEE-Api-Key-Integration
      // Pour OAuth2, utiliser Authorization Bearer
      const headers: HeadersInit = {
        Accept: "application/json",
      }

      // Si le token commence par "Bearer ", c'est un token OAuth2
      if (currentToken.startsWith("Bearer ")) {
        headers.Authorization = currentToken
      } else {
        // Clé API simple : utiliser le header X-INSEE-Api-Key-Integration
        headers["X-INSEE-Api-Key-Integration"] = currentToken
      }

      const response = await fetch(`${INSEE_SIRET_API_URL}/${siret}`, {
        method: "GET",
        headers,
      })

      // Gestion des codes HTTP
      if (response.status === 404) {
        const responseText = await response.text().catch(() => "")
        return {
          exists: false,
          siret,
          error: "SIRET introuvable dans la base de données INSEE",
        }
      }

      if (response.status === 401 || response.status === 403) {
        // Retry une seule fois avec un nouveau token
        if (attempt < maxRetries) {
          try {
            // Obtenir un nouveau token (le cache sera automatiquement ignoré si expiré)
            currentToken = await getInseeToken()
            // Réessayer avec le nouveau token
            continue
          } catch (tokenError) {
            return {
              exists: false,
              siret,
              error: "Service de vérification temporairement indisponible",
              unavailable: true,
            }
          }
        } else {
          return {
            exists: false,
            siret,
            error: "Service de vérification temporairement indisponible",
            unavailable: true,
          }
        }
      }

      if (response.status === 429) {
        return {
          exists: false,
          siret,
          error: "Trop de requêtes. Veuillez réessayer dans quelques instants.",
          unavailable: true,
        }
      }

      if (response.status >= 500 && response.status < 600) {
        return {
          exists: false,
          siret,
          error: "Service temporairement indisponible",
          unavailable: true,
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Erreur inconnue")
        return {
          exists: false,
          siret,
          error: `Erreur lors de la vérification (${response.status}): ${errorText}`,
          unavailable: false,
        }
      }

      // Succès : parser et mapper les données
      const data = (await response.json()) as InseeSireneResponse
      const result = mapInseeResponseToVerificationResult(siret, data)
      return result
    } catch (error) {
      // Erreur réseau ou autre
      if (attempt === maxRetries) {
        return {
          exists: false,
          siret,
          error: "Erreur réseau lors de la vérification",
          unavailable: true,
        }
      }
      // Continuer pour retry
      lastError = {
        exists: false,
        siret,
        error: "Erreur lors de la vérification",
        unavailable: true,
      }
    }
  }

  return (
    lastError ?? {
      exists: false,
      siret,
      error: "Erreur lors de la vérification",
      unavailable: true,
    }
  )
}

function mapInseeResponseToVerificationResult(
  siret: string,
  data: InseeSireneResponse
): SiretVerificationResponse {
  const etablissement = data.etablissement
  if (!etablissement) {
    return {
      exists: false,
      siret,
      error: "Données d'établissement introuvables",
    }
  }

  const uniteLegale = etablissement.uniteLegale

  // Raison sociale : priorité à denominationUniteLegale, puis denominationUsuelleEtablissement, puis enseigne1Etablissement
  const raison_sociale =
    uniteLegale?.denominationUniteLegale ||
    etablissement.denominationUsuelleEtablissement ||
    etablissement.enseigne1Etablissement ||
    undefined

  // Nom et prénom
  const nom = uniteLegale?.nomUniteLegale || undefined
  const prenom = uniteLegale?.prenom1UniteLegale || undefined

  // Statut juridique : priorité à libelleCategorieJuridiqueUniteLegale
  const statut_juridique =
    uniteLegale?.libelleCategorieJuridiqueUniteLegale ||
    uniteLegale?.categorieJuridiqueUniteLegale ||
    undefined

  // Adresse
  const adresseEtablissement = etablissement.adresseEtablissement
  let adresse: SiretVerificationResponse["adresse"] = null

  if (adresseEtablissement) {
    const numero = adresseEtablissement.numeroVoieEtablissement || ""
    const typeVoie = adresseEtablissement.typeVoieEtablissement || ""
    const libelleVoie = adresseEtablissement.libelleVoieEtablissement || ""
    const codePostal = adresseEtablissement.codePostalEtablissement || ""
    const ville = adresseEtablissement.libelleCommuneEtablissement || ""

    // Construire l'adresse seulement si on a au moins le code postal
    if (codePostal) {
      adresse = {
        numero,
        voie: libelleVoie,
        type_voie: typeVoie,
        code_postal: codePostal,
        ville,
      }
    }
  }

  return {
    exists: true,
    siret,
    raison_sociale,
    nom,
    prenom,
    statut_juridique,
    adresse,
  }
}

