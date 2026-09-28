# Piho Architecture Overview

*   **Core Desktop Layer:** Piho OS acts as an AI-native bridge between the user and the underlying operating system (Windows, macOS, Linux). It moves away from application-centric workflows toward an AI-first, intent-driven interface.
*   **Intelligent Assistant (PIHU):** The assistant serves as the primary interface, maintaining context of the entire workspace—including active windows, open projects, system resources, and user preferences.
*   **Project & Workspace Management:** Piho utilizes a sophisticated system for managing development environments (React, TypeScript, Vite) and project lifecycle, allowing for automated scaffolding, diagnosis, and hot-swapping project contexts.
*   **Semantic Memory (MemPalace):** This module ensures session continuity, keeping track of open files, session health, and previous project states across restarts.
*   **MCP (Model Context Protocol) Integration:** The system uses modular MCP servers to interact with the file system, web search, Google Workspace, and internal system processes, creating a secure, pluggable architecture.
*   **Privacy-First Design:** While it integrates with cloud AI, the system emphasizes local processing for system control and workspace awareness to protect user data.