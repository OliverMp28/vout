---
name: shadcn-ui
description: "Activate when building or modifying any React UI component in Vout. Enforces component-first development using the existing shadcn/ui components in resources/js/components/ui/. Prevents the AI from writing raw HTML/Tailwind from scratch when a shadcn component already exists. Trigger on: creating forms, dialogs, buttons, cards, inputs, dropdowns, navigation, badges, selects, switches, tooltips, or any UI element."
license: MIT
metadata:
  author: vout
---

# shadcn/ui — Component-First Development for Vout

## Core Principle

**Never write raw HTML or custom Tailwind for a UI element if a shadcn/ui component already exists.**

Check `resources/js/components/ui/` first. If the component exists → import it. If it doesn't exist → install it with `npx shadcn@latest add <component>` (via Sail: `./vendor/bin/sail bun x shadcn@latest add <component>`).

---

## Installed Components

The following components are already available in `resources/js/components/ui/`:

| Component | File | Use Case |
|---|---|---|
| `Alert` | `alert.tsx` | Feedback messages, warnings |
| `Avatar` | `avatar.tsx` | User avatars with fallback |
| `Badge` | `badge.tsx` | Status labels, tags |
| `Breadcrumb` | `breadcrumb.tsx` | Navigation breadcrumbs |
| `Button` | `button.tsx` | All clickable actions |
| `Card` | `card.tsx` | Content containers |
| `Checkbox` | `checkbox.tsx` | Boolean inputs |
| `Collapsible` | `collapsible.tsx` | Expandable sections |
| `Dialog` | `dialog.tsx` | Modal dialogs |
| `DropdownMenu` | `dropdown-menu.tsx` | Context menus, user menus |
| `Icon` | `icon.tsx` | Icon wrapper |
| `InputOTP` | `input-otp.tsx` | 2FA / OTP inputs |
| `Input` | `input.tsx` | Text inputs |
| `Label` | `label.tsx` | Form labels |
| `NavigationMenu` | `navigation-menu.tsx` | Top navigation |
| `PlaceholderPattern` | `placeholder-pattern.tsx` | Background patterns |
| `Select` | `select.tsx` | Dropdown selects |
| `Separator` | `separator.tsx` | Visual dividers |
| `Sheet` | `sheet.tsx` | Side panels / drawers |
| `Sidebar` | `sidebar.tsx` | App sidebar (complex) |
| `Skeleton` | `skeleton.tsx` | Loading states |
| `Spinner` | `spinner.tsx` | Loading indicators |
| `Switch` | `switch.tsx` | Toggle switches |
| `ToggleGroup` | `toggle-group.tsx` | Multi-option toggles |
| `Toggle` | `toggle.tsx` | Single toggle button |
| `Tooltip` | `tooltip.tsx` | Hover tooltips |

---

## Import Conventions

Always use the `@/` path alias:

```tsx
// ✅ Correct imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// ❌ Never use relative paths for UI components
import { Button } from '../../components/ui/button';
```

---

## Button Hierarchy (Vout Convention)

```tsx
// Primary action (default variant)
<Button id="btn-submit">Guardar cambios</Button>

// Secondary action
<Button variant="secondary" id="btn-cancel">Cancelar</Button>

// Destructive action
<Button variant="destructive" id="btn-delete">Eliminar cuenta</Button>

// Ghost (nav links, icon buttons)
<Button variant="ghost" size="icon" id="btn-menu" aria-label="Abrir menú">
  <Menu className="size-4" />
</Button>

// With icon (icon before text, gap-2)
<Button id="btn-google">
  <Google className="size-4" />
  Continuar con Google
</Button>
```

---

## Form Pattern

Always combine `Label` + `Input` with matching `htmlFor`/`id` for accessibility:

```tsx
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ✅ Accessible form field pattern
<div className="flex flex-col gap-2">
  <Label htmlFor="email">Correo electrónico</Label>
  <Input
    id="email"
    type="email"
    name="email"
    placeholder="tu@ejemplo.com"
    autoComplete="email"
    value={data.email}
    onChange={(e) => setData('email', e.target.value)}
  />
  {errors.email && (
    <p className="text-sm text-destructive">{errors.email}</p>
  )}
</div>
```

---

## Card Pattern

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

<Card className="hover:shadow-md transition-shadow duration-200">
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción opcional</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="secondary">Cancelar</Button>
    <Button>Guardar</Button>
  </CardFooter>
</Card>
```

---

## Dialog Pattern

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button variant="secondary" id="btn-open-dialog">Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título del diálogo</DialogTitle>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button id="btn-dialog-confirm">Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Skeleton Loading States

Always provide loading states for async content:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

// ✅ While loading
{isLoading ? (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-10 w-full" />
  </div>
) : (
  // Actual content
)}
```

---

## Avatar Pattern

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

<Avatar>
  <AvatarImage src={user.avatar} alt={user.name} />
  <AvatarFallback>
    {user.name.slice(0, 2).toUpperCase()}
  </AvatarFallback>
</Avatar>
```

---

## Icons (lucide-react)

Vout uses **only** `lucide-react` for icons:

```tsx
import { User, Settings, LogOut, Menu, X, ChevronDown } from 'lucide-react';

// In buttons: size-4, gap-2
<Button>
  <Settings className="size-4" />
  Configuración
</Button>

// In navigation: size-5
<User className="size-5" />

// Decorative: size-8 or larger
<Shield className="size-10 text-primary" />
```

---

## Installing Missing Components

If a needed component doesn't exist in `resources/js/components/ui/`, install it:

```bash
# Via Sail (required — never run npx directly)
./vendor/bin/sail bun x shadcn@latest add <component-name>

# Examples:
./vendor/bin/sail bun x shadcn@latest add table
./vendor/bin/sail bun x shadcn@latest add tabs
./vendor/bin/sail bun x shadcn@latest add accordion
./vendor/bin/sail bun x shadcn@latest add progress
./vendor/bin/sail bun x shadcn@latest add toast
```

---

## TypeScript Props Interface

Every component MUST have typed props:

```tsx
// ✅ Always define interfaces
interface UserCardProps {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  onEdit?: () => void;
  className?: string;
}

export function UserCard({ user, onEdit, className }: UserCardProps) {
  // ...
}
```

---

## Anti-Patterns

```tsx
// ❌ Don't write raw HTML when a component exists
<button className="bg-blue-500 text-white px-4 py-2 rounded">
  Click me
</button>

// ✅ Use the Button component
<Button>Click me</Button>

// ❌ Don't write a custom modal from scratch
<div className="fixed inset-0 z-50 ...">...</div>

// ✅ Use Dialog component
<Dialog>...</Dialog>

// ❌ Missing id on interactive elements
<Button>Save</Button>

// ✅ Always add unique id for testing
<Button id="btn-save-profile">Save</Button>
```

---

## ID Convention for Testing

Every interactive element needs a **unique, descriptive `id`**:

- Format: `[type]-[context]-[action]`
- Examples:
  - `btn-login-submit`
  - `btn-profile-save`
  - `input-email`
  - `select-language`
  - `switch-dark-mode`
  - `dialog-delete-account`
