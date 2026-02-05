# Formulaires - Design Guidelines

> Standards pour tous les formulaires du CRM

## Structure de base

### Layout formulaire

```tsx
<form onSubmit={handleSubmit} className="space-y-6">
  {/* Section groupée */}
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
      Informations client
    </h3>

    <div className="grid gap-4 sm:grid-cols-2">
      {/* Champs */}
    </div>
  </div>

  {/* Actions */}
  <div className="flex justify-end gap-3 pt-4 border-t">
    <Button type="button" variant="outline">Annuler</Button>
    <Button type="submit">Enregistrer</Button>
  </div>
</form>
```

## Composants de champ

### Input standard

```tsx
<div className="space-y-2">
  <Label htmlFor="name">
    Nom <span className="text-destructive">*</span>
  </Label>
  <Input
    id="name"
    type="text"
    placeholder="Jean Dupont"
    autoComplete="name"
    {...register('name', { required: true })}
  />
  {errors.name && (
    <p className="text-sm text-destructive">{errors.name.message}</p>
  )}
</div>
```

### Input avec icône

```tsx
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <div className="relative">
    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    <Input
      id="email"
      type="email"
      placeholder="contact@exemple.com"
      className="pl-10"
      autoComplete="email"
    />
  </div>
</div>
```

### Textarea

```tsx
<div className="space-y-2">
  <Label htmlFor="description">Description</Label>
  <Textarea
    id="description"
    placeholder="Décrivez l'intervention..."
    className="min-h-[100px] resize-y"
    {...register('description')}
  />
  <p className="text-xs text-muted-foreground">
    {watchDescription?.length || 0}/500 caractères
  </p>
</div>
```

### Select natif (shadcn)

```tsx
<div className="space-y-2">
  <Label htmlFor="status">Statut</Label>
  <Select value={status} onValueChange={setStatus}>
    <SelectTrigger id="status">
      <SelectValue placeholder="Sélectionner un statut" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="demanded">Demandé</SelectItem>
      <SelectItem value="quote">Devis envoyé</SelectItem>
      <SelectItem value="accepted">Accepté</SelectItem>
      <SelectItem value="inprogress">En cours</SelectItem>
      <SelectItem value="done">Terminé</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Combobox (searchable select)

```tsx
<div className="space-y-2">
  <Label>Artisan</Label>
  <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
      >
        {selectedArtisan
          ? artisans.find((a) => a.id === selectedArtisan)?.name
          : "Sélectionner un artisan..."}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-full p-0">
      <Command>
        <CommandInput placeholder="Rechercher..." />
        <CommandEmpty>Aucun artisan trouvé.</CommandEmpty>
        <CommandGroup>
          {artisans.map((artisan) => (
            <CommandItem
              key={artisan.id}
              value={artisan.name}
              onSelect={() => {
                setSelectedArtisan(artisan.id)
                setOpen(false)
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  selectedArtisan === artisan.id ? "opacity-100" : "opacity-0"
                )}
              />
              <Avatar className="w-6 h-6 mr-2">
                <AvatarFallback>{artisan.initials}</AvatarFallback>
              </Avatar>
              {artisan.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </Command>
    </PopoverContent>
  </Popover>
</div>
```

### Date Picker

```tsx
<div className="space-y-2">
  <Label>Date d'intervention</Label>
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          !date && "text-muted-foreground"
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, "PPP", { locale: fr }) : "Sélectionner une date"}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        locale={fr}
        initialFocus
      />
    </PopoverContent>
  </Popover>
</div>
```

### Checkbox

```tsx
<div className="flex items-center space-x-2">
  <Checkbox id="urgent" {...register('urgent')} />
  <Label htmlFor="urgent" className="cursor-pointer">
    Intervention urgente
  </Label>
</div>
```

### Radio Group

```tsx
<div className="space-y-3">
  <Label>Type d'intervention</Label>
  <RadioGroup value={type} onValueChange={setType} className="flex gap-4">
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="repair" id="repair" />
      <Label htmlFor="repair" className="cursor-pointer">Réparation</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="install" id="install" />
      <Label htmlFor="install" className="cursor-pointer">Installation</Label>
    </div>
    <div className="flex items-center space-x-2">
      <RadioGroupItem value="maintenance" id="maintenance" />
      <Label htmlFor="maintenance" className="cursor-pointer">Maintenance</Label>
    </div>
  </RadioGroup>
</div>
```

### Switch

```tsx
<div className="flex items-center justify-between rounded-lg border p-4">
  <div className="space-y-0.5">
    <Label htmlFor="notifications">Notifications</Label>
    <p className="text-sm text-muted-foreground">
      Recevoir des notifications par email
    </p>
  </div>
  <Switch
    id="notifications"
    checked={notifications}
    onCheckedChange={setNotifications}
  />
</div>
```

## Patterns de validation

### Validation temps réel (onBlur)

```tsx
const {
  register,
  formState: { errors },
} = useForm({
  mode: 'onBlur', // Valider au blur
  reValidateMode: 'onChange', // Revalider au change après première erreur
})
```

### Messages d'erreur

```tsx
{errors.email && (
  <p className="text-sm text-destructive flex items-center gap-1 mt-1">
    <AlertCircle className="w-3 h-3" />
    {errors.email.message}
  </p>
)}
```

### État des champs

```tsx
<Input
  className={cn(
    errors.name && "border-destructive focus:ring-destructive",
    isValid && "border-success focus:ring-success"
  )}
/>
```

## États de soumission

### Bouton loading

```tsx
<Button type="submit" disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      Enregistrement...
    </>
  ) : (
    <>
      <Save className="w-4 h-4 mr-2" />
      Enregistrer
    </>
  )}
</Button>
```

### Feedback succès

```tsx
{isSuccess && (
  <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success">
    <CheckCircle className="w-4 h-4" />
    <span className="text-sm">Enregistré avec succès</span>
  </div>
)}
```

### Feedback erreur

```tsx
{submitError && (
  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
    <AlertCircle className="w-4 h-4" />
    <span className="text-sm">{submitError}</span>
  </div>
)}
```

## Formulaires spécifiques

### Création d'intervention

```tsx
<form className="space-y-6">
  {/* Client */}
  <section className="space-y-4">
    <h3 className="text-sm font-medium uppercase text-muted-foreground">
      Client
    </h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <InputField name="client_name" label="Nom" required />
      <InputField name="client_phone" label="Téléphone" type="tel" required />
      <InputField name="client_email" label="Email" type="email" className="sm:col-span-2" />
      <TextareaField name="address" label="Adresse" required className="sm:col-span-2" />
    </div>
  </section>

  {/* Intervention */}
  <section className="space-y-4">
    <h3 className="text-sm font-medium uppercase text-muted-foreground">
      Intervention
    </h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField name="type" label="Type" options={interventionTypes} required />
      <DateField name="date" label="Date prévue" required />
      <ComboboxField name="artisan_id" label="Artisan" options={artisans} />
      <SelectField name="priority" label="Priorité" options={priorities} />
      <TextareaField name="description" label="Description" className="sm:col-span-2" />
    </div>
  </section>

  {/* Actions */}
  <div className="flex justify-end gap-3 pt-4 border-t">
    <Button type="button" variant="outline">Annuler</Button>
    <Button type="submit">Créer l'intervention</Button>
  </div>
</form>
```

### Formulaire inline (édition rapide)

```tsx
<div className="flex items-center gap-2">
  <Input
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    className="h-8"
    autoFocus
  />
  <Button size="sm" onClick={handleSave}>
    <Check className="w-3 h-3" />
  </Button>
  <Button size="sm" variant="ghost" onClick={handleCancel}>
    <X className="w-3 h-3" />
  </Button>
</div>
```

## Règles d'accessibilité

### Labels obligatoires

```tsx
// Correct
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />

// Incorrect - jamais faire
<Input placeholder="Email" /> // placeholder seul
```

### Attributs autocomplete

| Champ | Autocomplete |
|-------|--------------|
| Nom | `name` |
| Prénom | `given-name` |
| Nom famille | `family-name` |
| Email | `email` |
| Téléphone | `tel` |
| Adresse | `street-address` |
| Code postal | `postal-code` |
| Ville | `address-level2` |

### Types d'input

| Donnée | Type |
|--------|------|
| Email | `email` |
| Téléphone | `tel` |
| URL | `url` |
| Nombre | `number` |
| Recherche | `search` |
| Mot de passe | `password` |

## Responsive

### Mobile

- Champs en pleine largeur (`grid-cols-1`)
- Labels au-dessus des champs
- Boutons en pleine largeur

### Desktop

- Grid 2 colonnes quand pertinent
- Labels à côté ou au-dessus
- Actions alignées à droite
