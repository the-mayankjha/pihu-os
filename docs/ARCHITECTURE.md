# PIHU OS - Project Structure Documentation

## Overview

PIHU OS is built using a modular architecture.

The goal of this architecture is:

- Scalability
- Maintainability
- Separation of Concerns
- Independent Module Development
- Easy Testing
- Future AI Agent Integration

Every major feature is isolated into its own module and communicates through shared stores and services.

---

# High Level Architecture

```text
PIHU OS
│
├── App Layer
│
├── Core Layer
│
├── Module Layer
│
├── Shared Layer
│
├── Store Layer
│
├── Theme Layer
│
└── Tauri Backend
```

---

# Root Structure

```text
pihu-os/ 
├── src/
├── src-tauri/
├── assets/
├── docs/
├── public/
└── README.md
```

---

# src/

Contains all frontend code.

```text
src/
│
├── app/
├── core/
├── modules/
├── shared/
├── layouts/
├── stores/
├── hooks/
├── services/
├── types/
├── themes/
└── utils/
```

---

# app/

Responsible for bootstrapping the application.

```text
app/ 
 App.tsx
 router.tsx
 providers.tsx
 bootstrap.ts
```

## Responsibilities

### App.tsx

Main application entry point.

Responsible for:

- Rendering root layouts
- Loading providers
- Initializing UI

---

### router.tsx

Application navigation.

Future responsibilities:

- Workspace routing
- Deep linking

---

### providers.tsx

Global providers.

Examples:

```text
Theme Provider
Query Provider
Store Provider
```

---

### bootstrap.ts

Runs startup initialization logic.

Examples:

```text
Load settings
Load workspaces
Initialize voice system
```

---

# core/

Contains operating-system-level functionality.

```text
core/ 
 workspace/
 windows/
 tabs/
 orb/
 voice/
 dock/
 sidebar/
 notifications/
 settings/
```

Core is the heart of PIHU OS.

---

# workspace/

Manages Spaces.

Examples:

```text
Development
Research
Learning
Personal
```

Files:

```text
WorkspaceManager.ts
workspaceStore.ts
workspaceTypes.ts
```

Responsibilities:

- Create workspaces
- Delete workspaces
- Save layouts
- Restore layouts
- Switch workspace

---

# windows/

Manages panel layouts.

Examples:

```text
Split Panels
Floating Panels
Resizable Panels
```

Responsibilities:

- Create panels
- Resize panels
- Move panels
- Save layouts

Future:

```text
VSCode-style layout system
```

---

# tabs/

Responsible for tab management.

Examples:

```text
FKVim
Github
Notes
Browser
```

Responsibilities:

- Open tab
- Close tab
- Reorder tab
- Switch tab

---

# orb/

Contains the AI assistant visual system.

Examples:

```text
Idle
Listening
Thinking
Speaking
Executing
```

Files:

```text
OrbStateMachine.ts
OrbStore.ts
```

Responsibilities:

- Orb state management
- Orb animation control
- AI assistant visualization

---

# voice/

Voice infrastructure.

Structure:

```text
voice/ 
 wakeword/
 stt/
 tts/
 commands/
```

Responsibilities:

### wakeword/

OpenWakeWord integration.

Examples:

```text
hey_pihu.onnx
hi_pihu.onnx
pihu.onnx
```

---

### stt/

Speech To Text.

Future:

```text
Whisper
Faster Whisper
```

---

### tts/

Text To Speech.

Future:

```text
Piper
```

---

### commands/

Voice command processing.

Examples:

```text
Open FKTerm
Open Notes
Switch Workspace
```

---

# dock/

Responsible for the bottom dock.

Examples:

```text
FKVim
Notes
Browser
Github
```

Responsibilities:

- Render applications
- Launch modules
- Pin applications

---

# sidebar/

Responsible for navigation.

Examples:

```text
Home
Development
Research
Learning
Personal
```

Responsibilities:

- Workspace switching
- Navigation
- Quick access

---

# notifications/

Future notification system.

Responsibilities:

- System notifications
- Agent notifications
- Updates

---

# settings/

Application settings.

Responsibilities:

- Theme settings
- Voice settings
- Workspace settings

---

# modules/

Contains applications.

```text
modules/ 
 fkvim/
 fkterm/
 fknotes/
 github/
 browser/
 music/
 ai/
 settings/
```

Modules are independent.

Modules should never directly modify core systems.

Instead:

```text
Module 
 ↓
Store 
 ↓
Core
```

---

# fkvim/

PIHU's coding environment.

Future responsibilities:

- Editor
- AI coding
- Project management

---

# fkterm/

Terminal module.

Responsibilities:

- Shell sessions
- Logs
- Command execution

---

# fknotes/

Knowledge management.

Responsibilities:

- Notes
- Tasks
- Journals
- Knowledge base

---

# github/

Github integration.

Responsibilities:

- Repositories
- Pull Requests
- Issues

---

# browser/

Internal browser module.

Responsibilities:

- Research
- Documentation
- Web tools

---

# music/

Media player.

Responsibilities:

- Playback
- Playlist management

---

# ai/

Future AI agent workspace.

Responsibilities:

- Chat
- Agents
- Context memory

---

# shared/

Reusable UI components.

```text
shared/ 
 components/
 ui/
 icons/
 animations/
```

Everything here is reusable.

---

# shared/components/

Examples:

```text
GlassCard
GlassButton
DockItem
TabBar
SidebarItem
Orb
```

Should contain no business logic.

Only presentation.

---

# shared/ui/

Base UI primitives.

Examples:

```text
Button
Input
Dropdown
Modal
```

---

# shared/icons/

Application icons.

Examples:

```text
Dock Icons
Sidebar Icons
Orb Icons
```

---

# shared/animations/

Animation library.

Examples:

```text
Orb animations
Panel transitions
Workspace transitions
```

---

# layouts/

Contains layout definitions.

Examples:

```text
WorkspaceLayout
DashboardLayout
SplitLayout
```

Responsibilities:

- Arrange components
- Structure screens

Layouts do not contain business logic.

---

# stores/

Global state management.

Using:

```text
Zustand
```

Examples:

```text
workspaceStore.ts
orbStore.ts
voiceStore.ts
dockStore.ts
settingsStore.ts
```

Responsibilities:

- Global state
- State synchronization

---

# hooks/

Reusable React hooks.

Examples:

```text
useWorkspace()
useVoice()
useOrb()
```

Responsibilities:

- Encapsulate logic
- Reuse behavior

---

# services/

Application services.

Examples:

```text
VoiceService
WorkspaceService
PersistenceService
```

Responsibilities:

- Business logic
- External communication

---

# themes/

Theme system.

Examples:

```text
pihu-dark.ts
colors.ts
animations.ts
```

Responsibilities:

- Colors
- Spacing
- Shadows
- Typography

---

# utils/

Utility functions.

Examples:

```text
Date helpers
Formatters
Validators
```

No UI code.

No business logic.

---

# src-tauri/

Rust backend.

Responsibilities:

```text
System APIs
Native integrations
Voice service communication
Window management
File system access
```

Future:

```text
AI integrations
Background services
Agent execution
```

---

# Architectural Rules

## Rule 1

Modules must never directly talk to other modules.

Use stores or services.

---

## Rule 2

Shared components must remain generic.

Never place module-specific logic inside shared.

---

## Rule 3

Core owns the platform.

Modules consume the platform.

---

## Rule 4

All state lives in stores.

Avoid local state when shared state is needed.

---

## Rule 5

Everything opens in Tabs.

Applications are not windows.

Applications are Tabs inside Panels.

---

## Rule 6

Every Panel belongs to a Workspace.

Every Workspace stores its own layout.

---

# Future Vision

```text
Workspace
│
├── Panels
│
├── Tabs
│
├── Modules
│
└── AI Assistant
```

PIHU OS is not a collection of applications.

PIHU OS is an AI-native workspace where applications, agents, notes, terminals, and knowledge all live inside a unified environment managed by PIHU.
