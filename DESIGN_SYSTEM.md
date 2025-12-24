# Anker Charging Offline Planning Assistant - Design System

## 🎨 Color Palette

### Primary Colors
```css
--anker-blue: #00A0E9;              /* Primary brand blue */
--anker-blue-glow: #00A0E9;          /* Blue glow effect */
--anker-accent: #00d4aa;             /* Accent teal/green */
--anker-blue-dark: #0090d9;          /* Darker blue variant */
```

### Background Colors
```css
--anker-dark: #050508;               /* Deepest dark background */
--anker-dark-blue: #0a0d14;          /* Dark blue background */
--anker-surface: #151823;             /* Surface/card background */
--anker-chat-bg: #1e2335;            /* Chat container background */
--anker-surface-alt: #1a1d2e;        /* Alternative surface */
--anker-input-bg: #0d1421;           /* Input field background */
```

### Text Colors
```css
--anker-text-primary: #ffffff;        /* Primary text (white) */
--anker-text-secondary: #a0a0b0;      /* Secondary text (light gray) */
--anker-text-gray-200: #e5e7eb;       /* Light gray text */
--anker-text-gray-300: #d1d5db;       /* Medium gray text */
--anker-text-gray-400: #9ca3af;       /* Muted gray text */
--anker-text-gray-500: #6b7280;       /* Dark gray text */
```

### Border Colors
```css
--anker-border: rgba(0, 160, 233, 0.2);    /* Default border */
--anker-border-light: rgba(0, 160, 233, 0.3);  /* Light border */
--anker-border-medium: rgba(0, 160, 233, 0.4); /* Medium border */
```

### Semantic Colors
```css
--anker-error: #ef4444;               /* Red for errors */
--anker-error-bg: rgba(239, 68, 68, 0.1);  /* Error background */
--anker-light: #f8f9fa;               /* Light background (rarely used) */
```

## 📝 Typography

### Font Family
- **Primary Font**: `Space Grotesk` (Google Fonts)
- **Weights**: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold)
- **Fallback**: System sans-serif stack

### Font Sizes
```css
text-xs:    0.75rem;    /* 12px - Helper text, labels */
text-sm:    0.875rem;   /* 14px - Body text, buttons */
text-base:  1rem;       /* 16px - Default body */
text-lg:    1.125rem;   /* 18px - Large body */
text-xl:    1.25rem;    /* 20px - Headings */
text-2xl:   1.5rem;     /* 24px - Large headings */
```

### Font Weights
```css
font-normal:   400;      /* Regular text */
font-medium:   500;      /* Medium emphasis */
font-semibold: 600;      /* Semi-bold headings */
font-bold:     700;      /* Bold headings */
```

### Line Heights
```css
leading-tight:  1.25;    /* Tight spacing */
leading-normal: 1.5;     /* Normal spacing */
leading-relaxed: 1.75;   /* Relaxed spacing */
```

## 📐 Spacing System

### Padding
```css
p-1:   0.25rem;  /* 4px */
p-2:   0.5rem;   /* 8px */
p-3:   0.75rem;  /* 12px */
p-4:   1rem;     /* 16px */
p-6:   1.5rem;   /* 24px */
p-8:   2rem;     /* 32px */

px-2:  0.5rem;   /* 8px horizontal */
px-3:  0.75rem;  /* 12px horizontal */
px-4:  1rem;     /* 16px horizontal */
px-6:  1.5rem;   /* 24px horizontal */

py-1:  0.25rem;  /* 4px vertical */
py-1.5: 0.375rem; /* 6px vertical */
py-2:  0.5rem;   /* 8px vertical */
py-3:  0.75rem;  /* 12px vertical */
py-4:  1rem;     /* 16px vertical */
```

### Margin
```css
m-1:   0.25rem;  /* 4px */
m-2:   0.5rem;   /* 8px */
m-3:   0.75rem;  /* 12px */
m-4:   1rem;     /* 16px */
m-6:   1.5rem;   /* 24px */

mb-1:  0.25rem;  /* 4px bottom */
mb-2:  0.5rem;   /* 8px bottom */
mb-3:  0.75rem;  /* 12px bottom */
mb-4:  1rem;     /* 16px bottom */
mb-6:  1.5rem;   /* 24px bottom */

mt-2:  0.5rem;   /* 8px top */
mt-3:  0.75rem;  /* 12px top */
```

### Gap (Flexbox/Grid)
```css
gap-1:   0.25rem;  /* 4px */
gap-1.5: 0.375rem; /* 6px */
gap-2:   0.5rem;   /* 8px */
gap-3:   0.75rem;  /* 12px */
gap-4:   1rem;     /* 16px */
```

## 🎭 Visual Effects

### Border Radius
```css
rounded:     0.25rem;   /* 4px - Small elements */
rounded-lg:  0.5rem;    /* 8px - Standard elements */
rounded-xl:  0.75rem;   /* 12px - Large elements */
rounded-full: 9999px;   /* Full circle */
```

### Shadows
```css
shadow-sm:   0 1px 2px 0 rgba(0, 0, 0, 0.05);
shadow-md:   0 4px 6px -1px rgba(0, 0, 0, 0.1);
shadow-lg:   0 10px 15px -3px rgba(0, 0, 0, 0.1);
shadow-xl:   0 20px 25px -5px rgba(0, 0, 0, 0.1);
shadow-2xl:  0 25px 50px -12px rgba(0, 0, 0, 0.25);
```

### Neon Glow Effects
```css
.neon-glow {
  box-shadow: 
    0 0 10px rgba(0, 160, 233, 0.5),
    0 0 20px rgba(0, 160, 233, 0.3),
    0 0 30px rgba(0, 160, 233, 0.2);
}

.neon-glow-sm {
  box-shadow: 
    0 0 5px rgba(0, 160, 233, 0.4),
    0 0 10px rgba(0, 160, 233, 0.2);
}
```

### Backdrop Blur
```css
backdrop-blur-sm:  blur(4px);
backdrop-blur-md:  blur(12px);
backdrop-blur-lg:  blur(16px);
```

### Gradients
```css
/* Primary gradient (blue to teal) */
bg-gradient-to-r from-[#00A0E9] to-[#00d4aa]

/* User message gradient */
bg-gradient-to-br from-[#00A0E9] to-[#0090d9]

/* Avatar gradient */
bg-gradient-to-br from-[#00A0E9] to-[#00d4aa]

/* Text gradient */
background: linear-gradient(135deg, #00A0E9 0%, #00d4aa 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

## 📱 Layout Patterns

### Container Widths
```css
max-w-md:   28rem;   /* 448px - Small modals */
max-w-4xl:  56rem;   /* 896px - Content width */
max-w-6xl:  75rem;   /* 1200px - Page width */
```

### Header Structure
- Height: `py-3` (12px vertical padding)
- Background: `bg-[#151823]/90` with `backdrop-blur-md`
- Border: `border-b border-[#00A0E9]/30`
- Shadow: `shadow-lg`

### Chat Container
- Background: `bg-[#1e2335]/95` with `backdrop-blur-md`
- Border: `border border-[#00A0E9]/30`
- Border Radius: `rounded-lg`
- Shadow: `shadow-2xl neon-glow-sm`

### Message Bubbles
- User: `bg-gradient-to-br from-[#00A0E9] to-[#0090d9]` with `neon-glow-sm`
- Assistant: `bg-[#151823]` with `border border-[#00A0E9]/20`
- Max Width: `max-w-[75%]`
- Padding: `px-4 py-3`
- Border Radius: `rounded-lg`

## 🎬 Animations

### Fade In Up
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-bubble {
  animation: fadeInUp 0.3s ease-out;
}
```

### Typing Indicator Bounce
```css
@keyframes bounce {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
}

.typing-dot {
  animation: bounce 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) { animation-delay: 0s; }
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
```

## 🖼️ Background Effects

### Main Background
- Base: `linear-gradient(180deg, #050508 0%, #0a0d14 50%, #050508 100%)`
- Radial gradients for ambient lighting
- Diagonal light streaks at 135deg
- Vertical light streaks at 15%, 47%, 77%
- Animated glow orbs

### Glass Morphism
- Background: `bg-[color]/90` or `bg-[color]/95`
- Backdrop: `backdrop-blur-md`
- Border: `border border-[#00A0E9]/30`

## 🎯 Component Specifications

### Buttons

#### Primary Button
```css
background: linear-gradient(to right, #00A0E9, #00d4aa);
color: white;
padding: 0.75rem 1.5rem;
border-radius: 0.5rem;
box-shadow: 0 0 5px rgba(0, 160, 233, 0.4), 0 0 10px rgba(0, 160, 233, 0.2);
transition: all 0.2s;
```

#### Icon Button
```css
padding: 0.5rem;
color: #9ca3af;
border-radius: 0.5rem;
transition: all 0.2s;
hover: {
  color: #00A0E9;
  background: rgba(0, 160, 233, 0.1);
  box-shadow: 0 0 5px rgba(0, 160, 233, 0.4), 0 0 10px rgba(0, 160, 233, 0.2);
}
```

### Input Fields
```css
background: #0d1421;
border: 1px solid rgba(0, 160, 233, 0.3);
border-radius: 0.5rem;
padding: 0.75rem 1rem;
color: #e5e7eb;
font-size: 0.875rem;
focus: {
  outline: none;
  ring: 2px solid rgba(0, 160, 233, 0.5);
  border-color: #00A0E9;
}
```

### Cards
```css
background: #151823;
border: 1px solid rgba(0, 160, 233, 0.3);
border-radius: 0.5rem;
padding: 2rem;
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
box-shadow: 0 0 5px rgba(0, 160, 233, 0.4), 0 0 10px rgba(0, 160, 233, 0.2);
```

## 📊 Design Tokens Summary

| Category | Value |
|----------|-------|
| Primary Blue | `#00A0E9` |
| Accent Teal | `#00d4aa` |
| Dark Background | `#050508` |
| Surface | `#151823` |
| Chat Background | `#1e2335` |
| Text Primary | `#ffffff` |
| Text Secondary | `#a0a0b0` |
| Border Default | `rgba(0, 160, 233, 0.2)` |
| Border Radius | `0.5rem` (8px) |
| Font Family | `Space Grotesk` |
| Base Font Size | `0.875rem` (14px) |
| Container Width | `56rem` (896px) |

