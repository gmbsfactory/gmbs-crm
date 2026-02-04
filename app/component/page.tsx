"use client"

import React, { useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarGroup, AvatarGroupTooltip } from "@/components/ui/avatar-group"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { ExpandableAvatarGroup } from "@/components/ui/expandable-avatar-group"
import { StatusBadge, MetierBadge, AgenceBadge } from "@/components/ui/BadgeComponents"
import { ArtisanStatusBadge } from "@/components/ui/ArtisanStatusBadge"
import { Pagination } from "@/components/ui/pagination"
import Loader from "@/components/ui/Loader"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  Archive,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Eye,
  File,
  FileImage,
  FileText,
  Filter,
  FolderOpen,
  Grid3X3,
  Home,
  Image,
  Info,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Mail,
  MapPin,
  Menu,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react"

// =============================================================================
// TYPES
// =============================================================================

type DesignRef = {
  path: string
  label?: string
}

type ComponentShowcase = {
  id: string
  title: string
  description: string
  tags: string[]
  source: DesignRef[]
  usedIn: DesignRef[]
  version?: string
  preview: ReactNode
  fullWidth?: boolean
}

type ComponentCategory = {
  id: string
  title: string
  icon: ReactNode
  description: string
  components: ComponentShowcase[]
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockGestionnaires = [
  { id: "g-1", firstname: "Alice", lastname: "Martin", color: "#2563eb", code: "AM" },
  { id: "g-2", firstname: "Bruno", lastname: "Petit", color: "#0ea5e9", code: "BP" },
  { id: "g-3", firstname: "Chloe", lastname: "Durand", color: "#22c55e", code: "CD" },
  { id: "g-4", firstname: "Dylan", lastname: "Moreau", color: "#f97316", code: "DM" },
  { id: "g-5", firstname: "Emma", lastname: "Bernard", color: "#8b5cf6", code: "EB" },
  { id: "g-6", firstname: "Felix", lastname: "Rousseau", color: "#ec4899", code: "FR" },
  { id: "g-7", firstname: "Gabrielle", lastname: "Leroy", color: "#14b8a6", code: "GL" },
  { id: "g-8", firstname: "Hugo", lastname: "Simon", color: "#f59e0b", code: "HS" },
  { id: "g-9", firstname: "Isabelle", lastname: "Laurent", color: "#a855f7", code: "IL" },
  { id: "g-10", firstname: "Jules", lastname: "Michel", color: "#ef4444", code: "JM" },
  { id: "g-11", firstname: "Lea", lastname: "Garcia", color: "#06b6d4", code: "LG" },
  { id: "g-12", firstname: "Marc", lastname: "Dubois", color: "#84cc16", code: "MD" },
]

const mockInterventions = [
  {
    id: "INT-2024-001",
    client: "Dupont SCI",
    adresse: "15 rue de la Paix, 75002 Paris",
    type: "Plomberie",
    statut: "En cours",
    gestionnaire: mockGestionnaires[0],
    date: "15/01/2026",
  },
  {
    id: "INT-2024-002",
    client: "Martin SARL",
    adresse: "8 avenue Victor Hugo, 69002 Lyon",
    type: "Electricite",
    statut: "Planifiee",
    gestionnaire: mockGestionnaires[1],
    date: "18/01/2026",
  },
  {
    id: "INT-2024-003",
    client: "Garage Auto Plus",
    adresse: "Zone industrielle, 13008 Marseille",
    type: "Climatisation",
    statut: "Terminee",
    gestionnaire: mockGestionnaires[2],
    date: "12/01/2026",
  },
]

const mockComments = [
  {
    id: "c-1",
    author: mockGestionnaires[1],
    message: "Client contacte ce matin, RDV confirme pour demain 9h.",
    time: "14:32",
    date: "Aujourd'hui",
  },
  {
    id: "c-2",
    author: mockGestionnaires[0],
    message: "Parfait, j'ai prepare les documents. L'artisan est prevenu.",
    time: "15:05",
    date: "Aujourd'hui",
  },
  {
    id: "c-3",
    author: mockGestionnaires[2],
    message: "Intervention terminee avec succes. Facture envoyee.",
    time: "17:30",
    date: "Hier",
  },
]

const mockDocuments = [
  {
    id: "doc-1",
    name: "Devis_2026_001.pdf",
    kind: "Devis",
    size: "284 Ko",
    date: "12/01/2026",
    time: "14:32",
    author: mockGestionnaires[0],
    mimeType: "application/pdf",
  },
  {
    id: "doc-2",
    name: "Photo_avant_travaux.jpg",
    kind: "Photo",
    size: "1.2 Mo",
    date: "13/01/2026",
    time: "09:15",
    author: mockGestionnaires[2],
    mimeType: "image/jpeg",
  },
  {
    id: "doc-3",
    name: "Facture_F2026-0042.pdf",
    kind: "Facture",
    size: "156 Ko",
    date: "15/01/2026",
    time: "16:45",
    author: mockGestionnaires[1],
    mimeType: "application/pdf",
  },
  {
    id: "doc-4",
    name: "Plan_installation.pdf",
    kind: "Plan",
    size: "2.4 Mo",
    date: "10/01/2026",
    time: "11:20",
    author: mockGestionnaires[0],
    mimeType: "application/pdf",
  },
]

// =============================================================================
// COMPONENT SHOWCASES
// =============================================================================

function DocumentGmbsShowcase() {
  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Section Devis */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                Devis
              </Badge>
              <span className="text-[10px] text-muted-foreground">1 document</span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
              <Plus className="mr-1 h-3 w-3" />
              Ajouter
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="px-3 py-1.5 text-[10px]">Nom</TableHead>
                  <TableHead className="px-3 py-1.5 text-[10px] w-[80px]">Taille</TableHead>
                  <TableHead className="px-3 py-1.5 text-[10px] w-[100px]">Date</TableHead>
                  <TableHead className="px-3 py-1.5 text-[10px] w-[50px]">Par</TableHead>
                  <TableHead className="px-3 py-1.5 text-[10px] w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="h-10">
                  <TableCell className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-red-500" />
                      <span className="text-[11px] font-medium">{mockDocuments[0].name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-[10px] text-muted-foreground">
                    {mockDocuments[0].size}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-[10px] text-muted-foreground">
                    {mockDocuments[0].date}
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <GestionnaireBadge
                      firstname={mockDocuments[0].author.firstname}
                      lastname={mockDocuments[0].author.lastname}
                      color={mockDocuments[0].author.color}
                      size="xs"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Apercu</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ouvrir</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section Photos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 border-green-200">
                Photos
              </Badge>
              <span className="text-[10px] text-muted-foreground">1 document</span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
              <Plus className="mr-1 h-3 w-3" />
              Ajouter
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableBody>
                <TableRow className="h-10">
                  <TableCell className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-green-500" />
                      <span className="text-[11px] font-medium">{mockDocuments[1].name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-[10px] text-muted-foreground w-[80px]">
                    {mockDocuments[1].size}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-[10px] text-muted-foreground w-[100px]">
                    {mockDocuments[1].date}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 w-[50px]">
                    <GestionnaireBadge
                      firstname={mockDocuments[1].author.firstname}
                      lastname={mockDocuments[1].author.lastname}
                      color={mockDocuments[1].author.color}
                      size="xs"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-1.5 w-[100px]">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Section vide - Factures */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 border-orange-200">
                Factures
              </Badge>
              <span className="text-[10px] text-muted-foreground">0 document</span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
              <Plus className="mr-1 h-3 w-3" />
              Ajouter
            </Button>
          </div>
          <div className="rounded-md border border-dashed p-4 text-center">
            <Upload className="h-6 w-6 mx-auto text-muted-foreground/50" />
            <p className="text-[10px] text-muted-foreground mt-2">
              Glissez un fichier ou cliquez pour ajouter
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function DocumentLegacyShowcase() {
  return (
    <div className="space-y-4">
      {/* Tabs de filtrage */}
      <div className="flex items-center justify-between">
        <Tabs defaultValue="all" className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-[10px] px-3 h-7">
              Tous (4)
            </TabsTrigger>
            <TabsTrigger value="photos" className="text-[10px] px-3 h-7">
              Photos (1)
            </TabsTrigger>
            <TabsTrigger value="devis" className="text-[10px] px-3 h-7">
              Devis (1)
            </TabsTrigger>
            <TabsTrigger value="factures" className="text-[10px] px-3 h-7">
              Factures (1)
            </TabsTrigger>
            <TabsTrigger value="plans" className="text-[10px] px-3 h-7">
              Plans (1)
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-[10px]">
            <Upload className="mr-1.5 h-3 w-3" />
            Importer
          </Button>
          <Button size="sm" className="h-8 px-3 text-[10px]">
            <Plus className="mr-1.5 h-3 w-3" />
            Nouveau
          </Button>
        </div>
      </div>

      {/* Table des documents */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="h-9">
              <TableHead className="px-3 py-2 text-[10px]">Document</TableHead>
              <TableHead className="px-3 py-2 text-[10px] w-[80px]">Type</TableHead>
              <TableHead className="px-3 py-2 text-[10px] w-[80px]">Taille</TableHead>
              <TableHead className="px-3 py-2 text-[10px] w-[120px]">Ajoute le</TableHead>
              <TableHead className="px-3 py-2 text-[10px] w-[60px]">Par</TableHead>
              <TableHead className="px-3 py-2 text-[10px] w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDocuments.map((doc) => (
              <TableRow key={doc.id} className="h-11">
                <TableCell className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {doc.mimeType.includes("image") ? (
                      <FileImage className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium truncate">{doc.name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
                    {doc.kind}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-2 text-[10px] text-muted-foreground">
                  {doc.size}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="text-[10px] text-muted-foreground">
                    <span>{doc.date}</span>
                    <span className="ml-1 opacity-60">{doc.time}</span>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2">
                  <GestionnaireBadge
                    firstname={doc.author.firstname}
                    lastname={doc.author.lastname}
                    color={doc.author.color}
                    size="xs"
                  />
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination simple */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Affichage de 1-4 sur 4 documents</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" disabled>
            Precedent
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2" disabled>
            Suivant
          </Button>
        </div>
      </div>
    </div>
  )
}

function DocumentPreviewShowcase() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Image preview */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Image</p>
        <div className="rounded-lg border bg-muted/30 p-4 flex flex-col items-center justify-center min-h-[120px]">
          <FileImage className="h-10 w-10 text-green-500 mb-2" />
          <p className="text-xs font-medium">Photo_avant.jpg</p>
          <p className="text-[10px] text-muted-foreground">1.2 Mo - image/jpeg</p>
        </div>
      </div>

      {/* PDF preview */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">PDF</p>
        <div className="rounded-lg border bg-muted/30 p-4 flex flex-col items-center justify-center min-h-[120px]">
          <FileText className="h-10 w-10 text-red-500 mb-2" />
          <p className="text-xs font-medium">Devis_2026.pdf</p>
          <p className="text-[10px] text-muted-foreground">284 Ko - application/pdf</p>
        </div>
      </div>

      {/* Generic file */}
      <div className="space-y-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Autre</p>
        <div className="rounded-lg border bg-muted/30 p-4 flex flex-col items-center justify-center min-h-[120px]">
          <File className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-xs font-medium">Document.xlsx</p>
          <p className="text-[10px] text-muted-foreground">92 Ko - Apercu indisponible</p>
          <Button variant="link" size="sm" className="h-6 text-[10px] mt-1">
            <Download className="mr-1 h-3 w-3" />
            Telecharger
          </Button>
        </div>
      </div>
    </div>
  )
}

function ButtonShowcase() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-8">
      {/* Variants */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Variants</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </div>

      {/* Sizes */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tailles</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* States */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etats</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Disabled</Button>
          <Button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000) }}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement...</> : "Cliquer pour charger"}
          </Button>
        </div>
      </div>

      {/* With icons */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avec icones</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle intervention</Button>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Exporter</Button>
          <Button variant="secondary"><Filter className="mr-2 h-4 w-4" /> Filtres</Button>
          <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</Button>
        </div>
      </div>
    </div>
  )
}

function BadgeShowcase() {
  return (
    <div className="space-y-8">
      {/* Basic badges */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Badges de base</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </div>

      {/* Status badges */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status Badges</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label="Nouveau" tone="blue" />
          <StatusBadge label="En cours" tone="orange" />
          <StatusBadge label="Termine" tone="green" />
          <StatusBadge label="Annule" tone="red" />
          <StatusBadge label="En attente" tone="gray" />
          <StatusBadge label="Urgent" tone="purple" icon={<AlertCircle className="h-3 w-3" />} />
        </div>
      </div>

      {/* Metier badges */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Badges Metier</p>
        <div className="flex flex-wrap items-center gap-2">
          <MetierBadge metier="Plomberie" />
          <MetierBadge metier="Électricité" />
          <MetierBadge metier="Climatisation" />
          <MetierBadge metier="Menuiserie" />
          <MetierBadge metier="Peinture" />
          <MetierBadge metier="Chauffage" />
        </div>
      </div>

      {/* Agence badges */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Badges Agence</p>
        <div className="flex flex-wrap items-center gap-2">
          <AgenceBadge agence="Paris" />
          <AgenceBadge agence="Lyon" />
          <AgenceBadge agence="Marseille" />
        </div>
      </div>

      {/* Artisan status */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status Artisan</p>
        <div className="flex flex-wrap items-center gap-2">
          <ArtisanStatusBadge status="prospect" />
          <ArtisanStatusBadge status="en_controle" />
          <ArtisanStatusBadge status="qualifie" />
          <ArtisanStatusBadge status="a_recontacter" />
          <ArtisanStatusBadge status="inactif" />
          <ArtisanStatusBadge status="blacklist" />
        </div>
      </div>
    </div>
  )
}

function FormShowcase() {
  const [checked, setChecked] = useState(false)
  const [switched, setSwitched] = useState(false)

  return (
    <div className="space-y-8">
      {/* Inputs */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nom du client</Label>
          <Input id="name" placeholder="Entrez le nom..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="client@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telephone</Label>
          <Input id="phone" type="tel" placeholder="06 12 34 56 78" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="disabled">Champ desactive</Label>
          <Input id="disabled" disabled placeholder="Non modifiable" />
        </div>
      </div>

      {/* Textarea */}
      <div className="space-y-2">
        <Label htmlFor="description">Description de l&apos;intervention</Label>
        <Textarea
          id="description"
          placeholder="Decrivez le probleme rencontre..."
          className="min-h-[100px]"
        />
      </div>

      {/* Select */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Type d&apos;intervention</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Selectionnez un type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plomberie">Plomberie</SelectItem>
              <SelectItem value="electricite">Electricite</SelectItem>
              <SelectItem value="climatisation">Climatisation</SelectItem>
              <SelectItem value="menuiserie">Menuiserie</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priorite</Label>
          <Select defaultValue="normal">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Basse</SelectItem>
              <SelectItem value="normal">Normale</SelectItem>
              <SelectItem value="high">Haute</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Checkbox & Switch */}
      <div className="flex flex-wrap gap-8">
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" checked={checked} onCheckedChange={(c) => setChecked(c === true)} />
          <Label htmlFor="terms" className="cursor-pointer">Accepter les conditions</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="notifications" checked={switched} onCheckedChange={setSwitched} />
          <Label htmlFor="notifications" className="cursor-pointer">Activer les notifications</Label>
        </div>
      </div>
    </div>
  )
}

function ModalShowcase() {
  return (
    <div className="flex flex-wrap gap-4">
      {/* Standard Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Dialog standard</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;intervention</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l&apos;intervention ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Input defaultValue="Dupont SCI" />
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input defaultValue="15 rue de la Paix, 75002 Paris" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline">Annuler</Button>
            <Button>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Alert Dialog</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette intervention ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irreversible. L&apos;intervention sera definitivement supprimee
              ainsi que tous les documents associes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary"><Menu className="mr-2 h-4 w-4" /> Sheet (panneau)</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filtres avances</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Configurez vos filtres pour affiner la recherche.
            </p>
          </SheetHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="active">En cours</SelectItem>
                  <SelectItem value="done">Terminees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" />
            </div>
            <Button className="w-full">Appliquer les filtres</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function GenericModalShowcase() {
  return (
    <div className="space-y-6">
      {/* Explication des 3 modes */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Centerpage */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">Centerpage</span>
            <Badge variant="secondary" className="text-[9px]">Defaut</Badge>
          </div>
          <div className="relative h-32 rounded-lg border bg-muted/30 overflow-hidden">
            {/* Background overlay */}
            <div className="absolute inset-0 bg-black/20" />
            {/* Modal centered */}
            <div className="absolute inset-4 flex items-center justify-center">
              <div className="w-3/4 h-3/4 rounded-lg bg-card border shadow-lg flex flex-col">
                <div className="h-3 bg-muted rounded-t-lg" />
                <div className="flex-1 p-2">
                  <div className="h-2 w-1/2 bg-muted rounded mb-1" />
                  <div className="h-1.5 w-3/4 bg-muted/60 rounded" />
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Modal centree classique avec overlay. Ideal pour les formulaires.
          </p>
        </div>

        {/* Halfpage */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium">Halfpage</span>
            <Badge variant="outline" className="text-[9px]">Notion</Badge>
          </div>
          <div className="relative h-32 rounded-lg border bg-muted/30 overflow-hidden">
            {/* Left content (dimmed) */}
            <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-muted/40 p-2">
              <div className="h-2 w-3/4 bg-muted rounded mb-1" />
              <div className="h-1.5 w-1/2 bg-muted/60 rounded" />
            </div>
            {/* Right panel */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-card border-l shadow-lg">
              <div className="h-3 bg-muted" />
              <div className="p-2">
                <div className="h-2 w-2/3 bg-muted rounded mb-1" />
                <div className="h-1.5 w-1/2 bg-muted/60 rounded" />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Panneau lateral droit (50%). Style Notion, garde le contexte visible.
          </p>
        </div>

        {/* Fullpage */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <span className="text-sm font-medium">Fullpage</span>
            <Badge variant="outline" className="text-[9px]">Mobile</Badge>
          </div>
          <div className="relative h-32 rounded-lg border bg-card overflow-hidden">
            {/* Full content */}
            <div className="h-4 bg-muted flex items-center px-2">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 mr-1" />
              <div className="h-1.5 w-12 bg-muted-foreground/30 rounded" />
            </div>
            <div className="p-2">
              <div className="h-2 w-1/2 bg-muted rounded mb-2" />
              <div className="h-1.5 w-3/4 bg-muted/60 rounded mb-1" />
              <div className="h-1.5 w-2/3 bg-muted/60 rounded mb-1" />
              <div className="h-1.5 w-1/2 bg-muted/60 rounded" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Plein ecran, slide depuis le bas. Optimise pour mobile.
          </p>
        </div>
      </div>

      {/* Animations */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium mb-3">Animations par mode</p>
        <div className="grid gap-3 md:grid-cols-3 text-[10px]">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">centerpage</Badge>
            <span className="text-muted-foreground">scale + fade</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">halfpage</Badge>
            <span className="text-muted-foreground">slide-in-right</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px]">fullpage</Badge>
            <span className="text-muted-foreground">slide-in-bottom</span>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium mb-2">Utilisation dans le CRM</p>
        <div className="space-y-2 text-[10px] text-muted-foreground">
          <p>• <strong>InterventionModal</strong> utilise GenericModal avec mode configurable</p>
          <p>• <strong>ArtisanModal</strong> utilise GenericModal pour les fiches artisan</p>
          <p>• Le mode peut etre change via le <strong>ModalDisplayContext</strong></p>
        </div>
      </div>
    </div>
  )
}

function ToastShowcase() {
  return (
    <div className="space-y-6">
      {/* Toast variants - Style Sonner */}
      <div className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Variants (Sonner)
        </p>

        {/* Default toast - Sonner style */}
        <div className="relative flex w-full max-w-sm items-start gap-3 overflow-visible rounded-md border bg-background py-3 px-4 shadow-lg text-sm">
          <div className="flex-1 pr-4">
            <div className="font-semibold">Configuration sauvegardee</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              La configuration email des retards a ete mise a jour
            </div>
          </div>
          {/* Bouton fermeture externe rouge - style Sonner GMBS */}
          <button className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow-md flex items-center justify-center hover:bg-destructive/90">
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Toast with action - Sonner style */}
        <div className="relative flex w-full max-w-sm items-start gap-3 overflow-visible rounded-md border bg-background py-3 px-4 shadow-lg text-sm">
          <div className="flex-1 pr-4">
            <div className="font-semibold">Vous avez ete identifie dans un reminder</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Intervention #INT-2024-042 - Plomberie urgent
            </div>
            <Button size="sm" className="mt-2 h-7 text-xs px-3 font-medium">
              Voir
            </Button>
          </div>
          <button className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow-md flex items-center justify-center hover:bg-destructive/90">
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Error toast - Sonner style */}
        <div className="relative flex w-full max-w-sm items-start gap-3 overflow-visible rounded-md border border-destructive/30 bg-destructive/5 py-3 px-4 shadow-lg text-sm">
          <div className="flex-1 pr-4">
            <div className="font-semibold text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Erreur
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Impossible de sauvegarder les modifications
            </div>
          </div>
          <button className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow-md flex items-center justify-center hover:bg-destructive/90">
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Success toast - Sonner style */}
        <div className="relative flex w-full max-w-sm items-start gap-3 overflow-visible rounded-md border border-green-200 bg-green-50 py-3 px-4 shadow-lg text-sm">
          <div className="flex-1 pr-4">
            <div className="font-semibold text-green-800 flex items-center gap-2">
              <Check className="h-4 w-4" />
              Email de test envoye
            </div>
            <div className="text-xs text-green-700/80 mt-0.5">
              Verifiez votre boite de reception
            </div>
          </div>
          <button className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow-md flex items-center justify-center hover:bg-destructive/90">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Position */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium mb-3">Position par defaut</p>
        <div className="relative h-24 rounded border bg-background">
          <div className="absolute bottom-2 right-2 w-36 h-10 rounded bg-muted border shadow-sm flex items-center justify-center">
            <span className="text-[9px] text-muted-foreground">Toasts ici</span>
          </div>
          <span className="absolute top-2 left-2 text-[9px] text-muted-foreground">Ecran</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Les toasts Sonner apparaissent en bas a droite avec empilement.
        </p>
      </div>

      {/* Usage code hint - Sonner API */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium mb-2">Utilisation (Sonner)</p>
        <div className="text-[10px] text-muted-foreground space-y-1 font-mono bg-muted/50 p-2 rounded">
          <p>import {"{"} toast {"}"} from &quot;sonner&quot;</p>
          <p className="mt-2">{"// Simple"}</p>
          <p>toast(&quot;Configuration sauvegardee&quot;)</p>
          <p className="mt-2">{"// Avec description"}</p>
          <p>toast(&quot;Titre&quot;, {"{"}</p>
          <p className="pl-2">description: &quot;Details ici&quot;,</p>
          <p className="pl-2">duration: Infinity,</p>
          <p className="pl-2">closeButton: true,</p>
          <p className="pl-2">action: {"{"} label: &quot;Voir&quot;, onClick: ... {"}"}</p>
          <p>{"}"})</p>
        </div>
      </div>
    </div>
  )
}

function CardShowcase() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Basic Card */}
      <Card>
        <CardHeader>
          <CardTitle>Intervention #INT-2024-001</CardTitle>
          <CardDescription>Cree le 15/01/2026</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Dupont SCI</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>15 rue de la Paix, Paris</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>18/01/2026 - 9h00</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Badge variant="outline">Plomberie</Badge>
          <StatusBadge label="En cours" tone="orange" />
        </CardFooter>
      </Card>

      {/* Card with actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Artisan</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> Voir le profil</DropdownMenuItem>
              <DropdownMenuItem><Phone className="mr-2 h-4 w-4" /> Appeler</DropdownMenuItem>
              <DropdownMenuItem><Mail className="mr-2 h-4 w-4" /> Envoyer un email</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive"><Archive className="mr-2 h-4 w-4" /> Archiver</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <GestionnaireBadge
              firstname="Jean"
              lastname="Plombier"
              color="#2563eb"
              size="lg"
            />
            <div>
              <p className="font-semibold">Jean Plombier</p>
              <p className="text-sm text-muted-foreground">Plomberie - Paris</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <ArtisanStatusBadge status="qualifie" />
            <MetierBadge metier="Plomberie" />
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Interventions ce mois</CardDescription>
          <CardTitle className="text-4xl">128</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600 font-medium">+12%</span> par rapport au mois dernier
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function TableShowcase() {
  const [currentPage, setCurrentPage] = useState(1)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Reference</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden md:table-cell">Adresse</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Gestionnaire</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockInterventions.map((intervention) => (
              <TableRow key={intervention.id}>
                <TableCell className="font-medium">{intervention.id}</TableCell>
                <TableCell>{intervention.client}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {intervention.adresse}
                </TableCell>
                <TableCell>
                  <MetierBadge metier={intervention.type as "Plomberie" | "Électricité" | "Climatisation"} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <GestionnaireBadge
                      firstname={intervention.gestionnaire.firstname}
                      lastname={intervention.gestionnaire.lastname}
                      color={intervention.gestionnaire.color}
                      size="xs"
                    />
                    <span className="text-sm hidden lg:inline">
                      {intervention.gestionnaire.firstname}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={intervention.statut}
                    tone={
                      intervention.statut === "En cours" ? "orange" :
                      intervention.statut === "Terminee" ? "green" : "blue"
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> Voir</DropdownMenuItem>
                      <DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
                      <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Dupliquer</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={10}
        totalCount={97}
        pageSize={10}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}

function NavigationShowcase() {
  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tabs</p>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="comments">Commentaires</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="p-4 border rounded-lg mt-2">
            <p className="text-sm text-muted-foreground">Contenu de la vue d&apos;ensemble...</p>
          </TabsContent>
          <TabsContent value="documents" className="p-4 border rounded-lg mt-2">
            <p className="text-sm text-muted-foreground">Liste des documents...</p>
          </TabsContent>
          <TabsContent value="comments" className="p-4 border rounded-lg mt-2">
            <p className="text-sm text-muted-foreground">Fil de commentaires...</p>
          </TabsContent>
          <TabsContent value="history" className="p-4 border rounded-lg mt-2">
            <p className="text-sm text-muted-foreground">Historique des modifications...</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dropdown Menu */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dropdown Menu</p>
        <div className="flex gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Actions rapides</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem><Plus className="mr-2 h-4 w-4" /> Nouvelle intervention</DropdownMenuItem>
              <DropdownMenuItem><Upload className="mr-2 h-4 w-4" /> Importer</DropdownMenuItem>
              <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> Exporter</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Parametres</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Accordion */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Accordion</p>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Informations client</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                <p><strong>Nom:</strong> Dupont SCI</p>
                <p><strong>Contact:</strong> M. Dupont</p>
                <p><strong>Tel:</strong> 01 23 45 67 89</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Details de l&apos;intervention</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                <p><strong>Type:</strong> Plomberie</p>
                <p><strong>Urgence:</strong> Normale</p>
                <p><strong>Duree estimee:</strong> 2h</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Historique des interventions</AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground">3 interventions precedentes sur ce site.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}

function TooltipShowcase() {
  return (
    <div className="space-y-8">
      {/* Tooltips */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tooltips</p>
        <TooltipProvider>
          <div className="flex flex-wrap gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon"><Info className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Informations supplementaires</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon"><Bell className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>3 nouvelles notifications</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon"><Copy className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copier dans le presse-papier</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Popovers */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Popovers</p>
        <div className="flex flex-wrap gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Apercu client</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>DS</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">Dupont SCI</p>
                    <p className="text-sm text-muted-foreground">Client depuis 2022</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interventions</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CA total</span>
                    <span className="font-medium">24 500 EUR</span>
                  </div>
                </div>
                <Button className="w-full" size="sm">Voir la fiche complete</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

function AvatarShowcase() {
  return (
    <div className="space-y-8">
      {/* Basic Avatars */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avatars basiques</p>
        <div className="flex items-center gap-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback>AM</AvatarFallback>
          </Avatar>
          <Avatar className="h-10 w-10">
            <AvatarFallback>BP</AvatarFallback>
          </Avatar>
          <Avatar className="h-12 w-12">
            <AvatarFallback>CD</AvatarFallback>
          </Avatar>
          <Avatar className="h-16 w-16">
            <AvatarImage src="/placeholder-user.jpg" alt="User" />
            <AvatarFallback>DM</AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Gestionnaire Badges */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gestionnaire Badges</p>
        <div className="flex items-end gap-4">
          {mockGestionnaires.slice(0, 4).map((g) => (
            <div key={g.id} className="flex flex-col items-center gap-2">
              <GestionnaireBadge
                firstname={g.firstname}
                lastname={g.lastname}
                color={g.color}
                size="md"
              />
              <span className="text-xs text-muted-foreground">{g.code}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <span className="text-sm text-muted-foreground">Tailles:</span>
          <GestionnaireBadge firstname="A" lastname="M" color="#2563eb" size="xs" />
          <GestionnaireBadge firstname="A" lastname="M" color="#2563eb" size="sm" />
          <GestionnaireBadge firstname="A" lastname="M" color="#2563eb" size="md" />
          <GestionnaireBadge firstname="A" lastname="M" color="#2563eb" size="lg" />
        </div>
      </div>

      {/* Avatar Group */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avatar Group (hover pour voir)</p>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Motion variant</p>
            <AvatarGroup variant="motion" className="h-9 -space-x-2">
              {mockGestionnaires.slice(0, 5).map((g) => (
                <GestionnaireBadge
                  key={g.id}
                  firstname={g.firstname}
                  lastname={g.lastname}
                  color={g.color}
                  size="sm"
                >
                  <AvatarGroupTooltip>
                    <div className="text-xs">
                      <p className="font-semibold">{g.firstname} {g.lastname}</p>
                      <p className="text-muted-foreground">Code: {g.code}</p>
                    </div>
                  </AvatarGroupTooltip>
                </GestionnaireBadge>
              ))}
            </AvatarGroup>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">CSS variant</p>
            <AvatarGroup variant="css" className="h-9 -space-x-3">
              {mockGestionnaires.slice(0, 3).map((g) => (
                <GestionnaireBadge
                  key={g.id}
                  firstname={g.firstname}
                  lastname={g.lastname}
                  color={g.color}
                  size="sm"
                />
              ))}
            </AvatarGroup>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpandableAvatarShowcase() {
  const [clickedId, setClickedId] = React.useState<string | null>(null)

  return (
    <div className="space-y-8">
      {/* Expandable Avatar Group - Apple Style */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Expandable Avatar Group (Apple-like) ⭐
          </p>
          {clickedId && (
            <Badge variant="secondary" className="text-xs">
              Dernier clic: {mockGestionnaires.find(g => g.id === clickedId)?.firstname}
            </Badge>
          )}
        </div>
        
        {/* Demo with 5 items (no overflow) */}
        <div className="rounded-lg border bg-muted/20 p-6">
          <p className="text-xs text-muted-foreground mb-3">5 gestionnaires (pas de débordement)</p>
          <ExpandableAvatarGroup
            items={mockGestionnaires.slice(0, 5).map(g => ({
              id: g.id,
              firstname: g.firstname,
              lastname: g.lastname,
              color: g.color,
              searchText: `${g.firstname} ${g.lastname} ${g.code}`,
            }))}
            maxVisible={5}
            onAvatarClick={setClickedId}
          />
        </div>

        {/* Demo with 8 items (shows +4) */}
        <div className="rounded-lg border bg-muted/20 p-6">
          <p className="text-xs text-muted-foreground mb-3">8 gestionnaires (affiche +4)</p>
          <ExpandableAvatarGroup
            items={mockGestionnaires.slice(0, 8).map(g => ({
              id: g.id,
              firstname: g.firstname,
              lastname: g.lastname,
              color: g.color,
              searchText: `${g.firstname} ${g.lastname} ${g.code}`,
            }))}
            maxVisible={4}
            onAvatarClick={setClickedId}
          />
        </div>

        {/* Demo with all 12 items (shows +8 with search) */}
        <div className="rounded-lg border bg-muted/20 p-6">
          <p className="text-xs text-muted-foreground mb-3">12 gestionnaires (affiche +8, avec recherche)</p>
          <ExpandableAvatarGroup
            items={mockGestionnaires.map(g => ({
              id: g.id,
              firstname: g.firstname,
              lastname: g.lastname,
              color: g.color,
              searchText: `${g.firstname} ${g.lastname} ${g.code}`,
            }))}
            maxVisible={4}
            onAvatarClick={setClickedId}
          />
        </div>

        {/* Size variants */}
        <div className="rounded-lg border bg-muted/20 p-6 space-y-4">
          <p className="text-xs text-muted-foreground">Tailles disponibles</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-16">xs</span>
              <ExpandableAvatarGroup
                items={mockGestionnaires.slice(0, 6).map(g => ({ id: g.id, firstname: g.firstname, lastname: g.lastname, color: g.color }))}
                maxVisible={3}
                avatarSize="xs"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-16">sm</span>
              <ExpandableAvatarGroup
                items={mockGestionnaires.slice(0, 6).map(g => ({ id: g.id, firstname: g.firstname, lastname: g.lastname, color: g.color }))}
                maxVisible={3}
                avatarSize="sm"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-16">md</span>
              <ExpandableAvatarGroup
                items={mockGestionnaires.slice(0, 6).map(g => ({ id: g.id, firstname: g.firstname, lastname: g.lastname, color: g.color }))}
                maxVisible={3}
                avatarSize="md"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-16">lg</span>
              <ExpandableAvatarGroup
                items={mockGestionnaires.slice(0, 6).map(g => ({ id: g.id, firstname: g.firstname, lastname: g.lastname, color: g.color }))}
                maxVisible={3}
                avatarSize="lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-xs font-medium mb-3">Fonctionnalités Apple-like</p>
        <div className="grid gap-2 md:grid-cols-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Animations fluides (spring physics)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Badge +N pour items cachés</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Popover avec grille élégante</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Recherche automatique (12+ items)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Backdrop blur subtil</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Hover states délicats</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeedbackShowcase() {
  return (
    <div className="space-y-8">
      {/* Skeleton */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Skeleton (chargement)</p>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>

      {/* Loader principal - 5 carres animes */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Loader principal (Dashboard / Interventions)
        </p>
        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/10 p-8">
          <Loader />
          <p className="text-xs text-muted-foreground mt-2">
            Animation de 5 carres - utilise sur le dashboard et les vues de chargement
          </p>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono bg-muted/50 p-2 rounded">
          <p>import Loader from &quot;@/components/ui/Loader&quot;</p>
          <p className="mt-1">&lt;Loader /&gt;</p>
        </div>
      </div>

      {/* Loading states - boutons et inline */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etats de chargement (inline)</p>
        <div className="flex items-center gap-4">
          <Button disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Chargement...
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Synchronisation en cours...</span>
          </div>
        </div>
      </div>

      {/* Empty states */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etat vide</p>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <div className="rounded-full bg-muted p-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Aucun document</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Vous n&apos;avez pas encore ajoute de documents. Commencez par importer ou creer un nouveau document.
          </p>
          <Button className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Ajouter un document
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentShowcase() {
  return (
    <div className="max-w-2xl space-y-4">
      {mockComments.map((comment, idx) => (
        <div key={comment.id} className="flex items-start gap-3">
          <GestionnaireBadge
            firstname={comment.author.firstname}
            lastname={comment.author.lastname}
            color={comment.author.color}
            size="sm"
          />
          <div className="flex-1">
            <div
              className="rounded-2xl px-4 py-2.5"
              style={{
                backgroundColor: `${comment.author.color}20`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold">
                  {comment.author.firstname} {comment.author.lastname}
                </span>
                <span className="text-xs text-muted-foreground">{comment.time}</span>
              </div>
              <p className="text-sm">{comment.message}</p>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-start gap-3 pt-2">
        <GestionnaireBadge
          firstname={mockGestionnaires[0].firstname}
          lastname={mockGestionnaires[0].lastname}
          color={mockGestionnaires[0].color}
          size="sm"
        />
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder="Ajouter un commentaire..."
            className="min-h-[80px] resize-none"
          />
          <div className="flex justify-end">
            <Button size="sm">Envoyer</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// CATEGORIES DATA
// =============================================================================

const categories: ComponentCategory[] = [
  {
    id: "documents",
    title: "Documents",
    icon: <FolderOpen className="h-5 w-5" />,
    description: "Gestion des fichiers, upload et previews",
    components: [
      {
        id: "documents-gmbs",
        title: "Document Manager - GMBS",
        description: "Variante par defaut avec groupement par type et upload direct",
        tags: ["table", "upload", "grouped"],
        source: [
          { path: "src/components/documents/variants/docs_gmbs/DocumentManagerGmbs.tsx" },
          { path: "src/components/documents/useDocumentManager.ts", label: "hook" },
        ],
        usedIn: [
          { path: "src/components/interventions/InterventionEditForm.tsx" },
          { path: "src/components/ui/artisan-modal/ArtisanModalContent.tsx" },
        ],
        version: "v2.0",
        preview: <DocumentGmbsShowcase />,
        fullWidth: true,
      },
      {
        id: "documents-legacy",
        title: "Document Manager - Legacy",
        description: "Variante avec tabs de filtrage et table plate",
        tags: ["table", "tabs", "legacy"],
        source: [
          { path: "src/components/documents/variants/legacy/DocumentManagerLegacy.tsx" },
          { path: "src/components/documents/DocumentManagerRegistry.tsx", label: "registry" },
        ],
        usedIn: [
          { path: "Disponible via variant='legacy'" },
        ],
        version: "v1.0",
        preview: <DocumentLegacyShowcase />,
        fullWidth: true,
      },
      {
        id: "document-preview",
        title: "Document Preview",
        description: "Apercu de document (image, PDF, fichier generique)",
        tags: ["preview", "image", "pdf"],
        source: [
          { path: "src/components/documents/DocumentPreview.tsx" },
        ],
        usedIn: [
          { path: "src/components/documents/variants/docs_gmbs/DocumentManagerGmbs.tsx" },
          { path: "src/components/documents/variants/legacy/DocumentManagerLegacy.tsx" },
        ],
        version: "v1.0",
        preview: <DocumentPreviewShowcase />,
      },
    ],
  },
  {
    id: "buttons",
    title: "Boutons",
    icon: <Grid3X3 className="h-5 w-5" />,
    description: "Actions principales et secondaires",
    components: [
      {
        id: "button-variants",
        title: "Button",
        description: "Boutons avec variants, tailles et etats",
        tags: ["action", "cta", "form"],
        source: [{ path: "src/components/ui/button.tsx" }],
        usedIn: [
          { path: "Partout dans l'application" },
        ],
        version: "v1.0",
        preview: <ButtonShowcase />,
      },
    ],
  },
  {
    id: "badges",
    title: "Badges & Status",
    icon: <Badge className="h-5 w-5">B</Badge>,
    description: "Indicateurs visuels et etiquettes",
    components: [
      {
        id: "badge-variants",
        title: "Badges",
        description: "Tous les types de badges du CRM",
        tags: ["status", "label", "indicator"],
        source: [
          { path: "src/components/ui/badge.tsx" },
          { path: "src/components/ui/BadgeComponents.tsx" },
          { path: "src/components/ui/ArtisanStatusBadge.tsx" },
        ],
        usedIn: [
          { path: "src/features/interventions/" },
          { path: "src/features/artisans/" },
        ],
        version: "v1.2",
        preview: <BadgeShowcase />,
      },
    ],
  },
  {
    id: "forms",
    title: "Formulaires",
    icon: <Edit className="h-5 w-5" />,
    description: "Champs de saisie et controles",
    components: [
      {
        id: "form-elements",
        title: "Elements de formulaire",
        description: "Inputs, selects, checkboxes, switches",
        tags: ["input", "form", "control"],
        source: [
          { path: "src/components/ui/input.tsx" },
          { path: "src/components/ui/textarea.tsx" },
          { path: "src/components/ui/select.tsx" },
          { path: "src/components/ui/checkbox.tsx" },
          { path: "src/components/ui/switch.tsx" },
          { path: "src/components/ui/label.tsx" },
        ],
        usedIn: [
          { path: "src/features/interventions/forms/" },
          { path: "src/features/artisans/forms/" },
        ],
        version: "v1.0",
        preview: <FormShowcase />,
        fullWidth: true,
      },
    ],
  },
  {
    id: "modals",
    title: "Modals & Overlays",
    icon: <LayoutGrid className="h-5 w-5" />,
    description: "Dialogues, sheets et popovers",
    components: [
      {
        id: "modal-variants",
        title: "Modals",
        description: "Dialog, AlertDialog et Sheet",
        tags: ["modal", "dialog", "overlay"],
        source: [
          { path: "src/components/ui/dialog.tsx" },
          { path: "src/components/ui/alert-dialog.tsx" },
          { path: "src/components/ui/sheet.tsx" },
        ],
        usedIn: [
          { path: "src/components/shared/StatusReasonModal.tsx" },
          { path: "src/components/ui/artisan-modal/" },
        ],
        version: "v1.0",
        preview: <ModalShowcase />,
      },
      {
        id: "generic-modal",
        title: "GenericModal",
        description: "Modal avec 3 modes d'affichage: centerpage, halfpage, fullpage",
        tags: ["modal", "overlay", "animation", "portal"],
        source: [
          { path: "src/components/ui/modal/GenericModal.tsx" },
          { path: "src/types/modal-display.ts" },
        ],
        usedIn: [
          { path: "src/features/interventions/modals/" },
          { path: "src/components/ui/artisan-modal/" },
        ],
        version: "v2.0",
        preview: <GenericModalShowcase />,
        fullWidth: true,
      },
    ],
  },
  {
    id: "cards",
    title: "Cards",
    icon: <FileText className="h-5 w-5" />,
    description: "Conteneurs d'information",
    components: [
      {
        id: "card-variants",
        title: "Cards",
        description: "Cartes basiques, avec actions, statistiques",
        tags: ["container", "info", "layout"],
        source: [
          { path: "src/components/ui/card.tsx" },
          { path: "src/components/ui/DealCard.tsx" },
        ],
        usedIn: [
          { path: "app/dashboard/page.tsx" },
          { path: "src/features/interventions/" },
        ],
        version: "v1.0",
        preview: <CardShowcase />,
        fullWidth: true,
      },
    ],
  },
  {
    id: "tables",
    title: "Tables & Data",
    icon: <List className="h-5 w-5" />,
    description: "Affichage de donnees tabulaires",
    components: [
      {
        id: "table-full",
        title: "Table avec pagination",
        description: "Table complete avec actions et pagination",
        tags: ["data", "list", "pagination"],
        source: [
          { path: "src/components/ui/table.tsx" },
          { path: "src/components/ui/pagination.tsx" },
        ],
        usedIn: [
          { path: "src/features/interventions/views/TableView.tsx" },
          { path: "src/features/artisans/" },
        ],
        version: "v1.1",
        preview: <TableShowcase />,
        fullWidth: true,
      },
    ],
  },
  {
    id: "navigation",
    title: "Navigation",
    icon: <Menu className="h-5 w-5" />,
    description: "Tabs, menus et accordeons",
    components: [
      {
        id: "nav-elements",
        title: "Elements de navigation",
        description: "Tabs, dropdown menus, accordeons",
        tags: ["tabs", "menu", "accordion"],
        source: [
          { path: "src/components/ui/tabs.tsx" },
          { path: "src/components/ui/dropdown-menu.tsx" },
          { path: "src/components/ui/accordion.tsx" },
        ],
        usedIn: [
          { path: "src/features/interventions/" },
          { path: "src/features/settings/" },
        ],
        version: "v1.0",
        preview: <NavigationShowcase />,
        fullWidth: true,
      },
    ],
  },
  {
    id: "tooltips",
    title: "Tooltips & Popovers",
    icon: <Info className="h-5 w-5" />,
    description: "Informations contextuelles",
    components: [
      {
        id: "tooltip-popover",
        title: "Tooltips et Popovers",
        description: "Informations au survol et au clic",
        tags: ["tooltip", "popover", "info"],
        source: [
          { path: "src/components/ui/tooltip.tsx" },
          { path: "src/components/ui/popover.tsx" },
          { path: "src/components/ui/hover-card.tsx" },
        ],
        usedIn: [
          { path: "src/components/ui/avatar-group.tsx" },
          { path: "Partout dans l'application" },
        ],
        version: "v1.0",
        preview: <TooltipShowcase />,
      },
    ],
  },
  {
    id: "avatars",
    title: "Avatars & Users",
    icon: <Users className="h-5 w-5" />,
    description: "Representation des utilisateurs",
    components: [
      {
        id: "avatar-all",
        title: "Avatars",
        description: "Avatar simple, GestionnaireBadge, AvatarGroup",
        tags: ["user", "avatar", "team"],
        source: [
          { path: "src/components/ui/avatar.tsx" },
          { path: "src/components/ui/gestionnaire-badge.tsx" },
          { path: "src/components/ui/avatar-group.tsx" },
        ],
        usedIn: [
          { path: "app/dashboard/page.tsx" },
          { path: "src/components/shared/CommentSection.tsx" },
        ],
        version: "v1.3",
        preview: <AvatarShowcase />,
      },
      {
        id: "expandable-avatar-group",
        title: "Expandable Avatar Group",
        description: "Groupe d'avatars avec expansion Apple-like - affiche N premiers, +N pour le reste avec popover",
        tags: ["avatar", "group", "expandable", "apple", "popover"],
        source: [
          { path: "src/components/ui/expandable-avatar-group.tsx" },
          { path: "src/components/ui/gestionnaire-badge.tsx" },
          { path: "src/components/ui/popover.tsx" },
        ],
        usedIn: [
          { path: "app/component/page.tsx", label: "prototype" },
        ],
        version: "v1.0",
        preview: <ExpandableAvatarShowcase />,
        fullWidth: true,
      },
    ],
  },
  {
    id: "feedback",
    title: "Feedback & Loading",
    icon: <Loader2 className="h-5 w-5" />,
    description: "Etats de chargement et retours",
    components: [
      {
        id: "feedback-states",
        title: "Etats de feedback",
        description: "Skeleton, loading, etats vides",
        tags: ["loading", "skeleton", "empty"],
        source: [
          { path: "src/components/ui/skeleton.tsx" },
          { path: "src/components/ui/Loader.tsx" },
          { path: "src/components/ui/toast.tsx" },
        ],
        usedIn: [
          { path: "Partout dans l'application" },
        ],
        version: "v1.0",
        preview: <FeedbackShowcase />,
        fullWidth: true,
      },
      {
        id: "toast-notifications",
        title: "Toast Notifications",
        description: "Notifications temporaires avec variantes (default, destructive, success)",
        tags: ["toast", "notification", "alert", "feedback"],
        source: [
          { path: "src/components/ui/toast.tsx" },
          { path: "src/components/ui/toaster.tsx" },
          { path: "src/hooks/use-toast.ts" },
        ],
        usedIn: [
          { path: "Partout dans l'application" },
          { path: "app/layout.tsx (Toaster)" },
        ],
        version: "v1.0",
        preview: <ToastShowcase />,
        fullWidth: true,
      },
    ],
  },
  {
    id: "comments",
    title: "Commentaires",
    icon: <FileText className="h-5 w-5" />,
    description: "Fil de discussion",
    components: [
      {
        id: "comment-thread",
        title: "Thread de commentaires",
        description: "Fil de discussion avec avatars et actions",
        tags: ["chat", "thread", "discussion"],
        source: [
          { path: "src/components/shared/CommentSection.tsx" },
        ],
        usedIn: [
          { path: "src/features/interventions/" },
          { path: "src/components/ui/artisan-modal/" },
        ],
        version: "v2.0",
        preview: <CommentShowcase />,
      },
    ],
  },
]

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function ComponentLibraryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedComponent, setSelectedComponent] = useState<ComponentShowcase | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      components: cat.components.filter(
        (comp) =>
          comp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comp.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }))
    .filter((cat) => cat.components.length > 0)
    .filter((cat) => !selectedCategory || cat.id === selectedCategory)

  return (
    <div id="top" className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                DS
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Design System</h1>
                <p className="text-xs text-muted-foreground">GMBS CRM Components</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un composant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline" className="hidden md:flex">
              {categories.reduce((acc, cat) => acc + cat.components.length, 0)} composants
            </Badge>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-2 px-6 pb-3 overflow-x-auto">
          <Button
            variant={selectedCategory === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="shrink-0"
          >
            Tous
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="shrink-0"
            >
              {cat.icon}
              <span className="ml-2">{cat.title}</span>
            </Button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="px-6 py-8">
        <div className="space-y-16">
          {filteredCategories.map((category) => (
            <section key={category.id} id={category.id} className="scroll-mt-32">
              {/* Category header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    {category.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{category.title}</h2>
                    <p className="text-muted-foreground">{category.description}</p>
                  </div>
                </div>
              </div>

              {/* Components */}
              <div className="space-y-8">
                {category.components.map((component) => (
                  <div
                    key={component.id}
                    data-testid={`design-card-${component.id}`}
                    className="rounded-xl border bg-card shadow-sm overflow-hidden"
                  >
                    {/* Component header */}
                    <div
                      className="flex items-center justify-between border-b px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedComponent(selectedComponent?.id === component.id ? null : component)}
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold" data-testid={selectedComponent?.id === component.id ? "design-details-title" : undefined}>
                            {component.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">{component.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2">
                          {component.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        {component.version && (
                          <Badge variant="secondary" className="text-xs">
                            {component.version}
                          </Badge>
                        )}
                        <ChevronDown
                          className={cn(
                            "h-5 w-5 text-muted-foreground transition-transform",
                            selectedComponent?.id === component.id && "rotate-180"
                          )}
                        />
                      </div>
                    </div>

                    {/* Component preview - always visible */}
                    <div className="p-6 bg-muted/20">
                      {component.preview}
                    </div>

                    {/* Component details - expandable */}
                    {selectedComponent?.id === component.id && (
                      <div className="border-t bg-muted/10 px-6 py-4">
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Fichiers source
                            </p>
                            <ul className="space-y-1">
                              {component.source.map((s) => (
                                <li key={s.path} className="flex items-center gap-2 text-sm">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.path}</code>
                                  {s.label && (
                                    <span className="text-xs text-muted-foreground">({s.label})</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Utilise dans
                            </p>
                            <ul className="space-y-1">
                              {component.usedIn.map((u) => (
                                <li key={u.path} className="flex items-center gap-2 text-sm">
                                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{u.path}</code>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Aucun resultat</h3>
            <p className="text-muted-foreground mt-1">
              Essayez un autre terme de recherche ou filtrez par categorie.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory(null)
              }}
            >
              Reinitialiser les filtres
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-6 mt-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>GMBS CRM Design System - Documentation interne</p>
          <div className="flex items-center gap-4">
            <span>Stack: Next.js 15 + Tailwind + Radix UI</span>
            <Separator orientation="vertical" className="h-4" />
            <span>{new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
