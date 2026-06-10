# **🌸 PIHU OS**

**An AI-Native Workspace Layer for Windows, macOS, and Linux**

PIHU OS is a cross-platform desktop environment built with **Tauri**, designed to sit on top of existing operating systems and transform them into intelligent, AI-powered workspaces. Instead of replacing your operating system, PIHU OS becomes the layer through which you work, think, create, and collaborate.

At its core, PIHU OS combines AI assistance, workspace management, modular applications, voice interaction, and a premium glassmorphism interface into a unified experience.

---

## **✨ Vision**

Modern operating systems are application-centric.

PIHU OS is **workspace-centric and AI-centric**.

Instead of:

```
Open App → Find File → Search Notes → Ask AI
```

PIHU OS enables:

```
Ask PIHU → PIHU Finds Context → Executes Actions → Assists You
```

The goal is to create a workspace where AI is not another application, but an integral part of the operating environment.

---

## **🎯 Core Principles**

### **AI First**

PIHU acts as the central intelligence layer of the workspace.

### **Workspace Based**

Everything belongs to a workspace:

- Development
- Research
- Learning
- Personal

### **Local First**

User data remains on the user’s device whenever possible.

### **Modular**

Every feature is implemented as an independent module.

### **Cross Platform**

Runs on:

- Windows
- macOS
- Linux

using a single codebase powered by Tauri.

---

# **🏗 Architecture**

```
┌─────────────────────────────────────┐
│             PIHU OS                 │
│                                     │
│  AI Orb • Workspaces • Notes        │
│  FKVim • FKTerm • Voice • Agents    │
│                                     │
└─────────────────────────────────────┘
                ▲
                │
        Tauri + Rust Core
                ▲
                │
┌─────────────────────────────────────┐
│ Windows • macOS • Linux             │
└─────────────────────────────────────┘
```

---

# **🌸 Features**

## **AI Orb**

The Orb is the heart of PIHU OS.

States:

- Idle
- Listening
- Thinking
- Executing
- Speaking

Future versions will support:

- Voice conversations
- Context awareness
- Agent orchestration

---

## **Workspaces**

Workspaces allow users to separate different contexts.

Examples:

```
Development
Research
Learning
Personal
```

Each workspace stores:

- Layout
- Open tabs
- Panels
- State
- Preferences

---

## **Panel System**

PIHU OS uses a panel-based layout system.

```
┌─────────────┬─────────────┐
│ FKVim       │ Notion      │
│             │             │
└─────────────┴─────────────┘

┌───────────────────────────┐
│ FKTerm                    │
└───────────────────────────┘
```

Panels support:

- Tabs
- Splits
- Drag and Drop
- Layout Persistence

---

## **Tab System**

Applications open inside tabs instead of separate windows.

Examples:

```
FKVim
Notion
GitHub
Browser
Music
```

---

## **Dock**

The Dock provides quick access to applications and modules.

Unlike traditional operating systems, applications launch inside workspace panels instead of opening separate windows.

---

## **Voice Assistant**

Powered by:

- OpenWakeWord
- Whisper
- Piper

Supported wake words:

```
Hey Pihu
Hi Pihu
Pihu
```

Voice Pipeline:

```
Wake Word
    ↓
Speech Recognition
    ↓
AI Processing
    ↓
Execution
    ↓
Response
```

---

# **🎨 Design Language**

PIHU OS follows a premium visual identity built around:

### **Theme**

- Dark Interface
- Glassmorphism
- Soft Glow Effects
- Pink Accent Colors

### **Branding**

Primary Identity:

- Pink Orb
- Lotus-inspired Symbol
- No Text Logo

### **Typography**

- Geist
- Inter

### **Visual Style**

Inspired by:

- Apple Design
- Arc Browser
- Modern AI Interfaces

while maintaining a unique PIHU identity.

---
# **UI** 
<img width="1433" height="955" alt="image" src="https://github.com/user-attachments/assets/6c3fbf09-fb80-484b-a317-4945729d848e" />

<img width="1437" height="954" alt="image" src="https://github.com/user-attachments/assets/0790e1a6-be5d-4d74-bcbf-b4298a7dca25" />

<img width="1437" height="954" alt="image" src="https://github.com/user-attachments/assets/8ff1c3af-ee6a-442f-af4e-a60d800eb6b3" />






# **🧩 Modules**

Planned modules include:

```
FKVim
FKTerm
FKNotes
Browser
GitHub
Music
AI Assistant
Settings
Files
```

Each module is independently developed and loaded by the workspace manager.

---

# **🛠 Technology Stack**

## **Frontend**

- React
- TypeScript
- Tailwind CSS
- Framer Motion

## **Backend**

- Tauri v2
- Rust

## **State Management**

- Zustand

## **Layout System**

- react-resizable-panels
- dnd-kit

## **AI Stack**

- OpenWakeWord
- Whisper
- Piper
- Local LLM Support

---

# **🚀 Roadmap**

## **Phase 1**

- Branding
- Theme System
- Orb
- Sidebar
- Dock

## **Phase 2**

- Workspace Manager
- Tab System
- Panel System

## **Phase 3**

- Split Layouts
- Layout Persistence
- Drag and Drop

## **Phase 4**

- OpenWakeWord Integration
- Voice Pipeline

## **Phase 5**

- FKVim
- FKTerm
- FKNotes

## **Phase 6**

- AI Agents
- Workspace Automation
- Context Awareness

---

# **🌟 Long-Term Goal**

PIHU OS aims to become an AI-native workspace layer that transforms existing operating systems into intelligent environments where users can create, learn, research, and build with AI as a natural companion rather than a separate tool.

---

**PIHU OS**

*An Operating System for Thought.*
