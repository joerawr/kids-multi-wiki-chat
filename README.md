# Knowledge Quest

A family-friendly wiki helper that lets kids explore multiple themed wikis without ads or tracking. The app runs locally on your computer, uses AI models for natural-language chat, and spins up dedicated Model Context Protocol (MCP) servers to fetch accurate information straight from curated wikis.

This README is aimed at tech-savvy parents who want to host a safe research companion at home while keeping full control over the data flow.

[<img src="public/screenshot.png" alt="Knowledge Quest Screenshot" height="300">](public/screenshot.png)

---

## Why You Might Like This
- **Kid-first browsing** – questions are answered with age-appropriate language and clear citations instead of search-engine rabbit holes.
- **Six instant knowledge modes** – switch between Lego, Minecraft, Pokémon, Star Wars, Wikipedia, and Wings of Fire wikis with image buttons.
- **No mystery cloud services** – everything runs on your machine; stop the app and all MCP processes shut down.
- **Built to extend** – add new wikis or swap AI models as your family’s interests change.

---

## Using the App with Your Kids
1. Click one of the six image buttons to select a wiki source:
   - **Lego** – Brickimedia wiki for LEGO sets, themes, and building guides
   - **Minecraft** – Official Minecraft Wiki for gameplay, blocks, and mechanics
   - **Pokémon** – Bulbapedia for Pokémon species, games, and lore
   - **Star Wars** – Fandom wiki for characters, planets, and storylines
   - **Wikipedia** – General knowledge and encyclopedic information
   - **Wings of Fire** – Fandom wiki for the dragon book series
2. Ask a question in the chat box. The app starts the appropriate MCP server if it isn't already running.
3. Responses include wiki-backed facts when available; if the wrong source is active, the assistant politely reminds you to switch.
4. Change sources at any time—the previous MCP server is stopped automatically.

**Tip:** The footer shows the current AI model. Future updates will let you switch between models without editing code.

---

## Prerequisites
- **Node.js 20+** (for the Next.js front end). Installing via [volta](https://volta.sh) or [nvm](https://github.com/nvm-sh/nvm) keeps things tidy.
- **pnpm** package manager: `npm install -g pnpm`.
- **Python 3.11+** (already vendored in `mcp-servers/wikipedia/venv`, but you can recreate it if you prefer).
- **OpenAI API key** – create one in the [OpenAI Platform](https://platform.openai.com/) dashboard (supports GPT-5, GPT-5 Mini, and other models).
- **Google Gemini API key** (optional) – create one in the [Google AI Studio](https://aistudio.google.com/) dashboard.

Optional (for future extensions): Docker, git, and familiarity with MCP protocols.

---

## Getting Started

### Quick Setup (Recommended)

1. **Run the install script**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
   This installs all dependencies for the main project and all MCP servers.

2. **Configure your API keys**
   Create a `.env.local` file with your API keys:
   ```bash
   echo "OPENAI_API_KEY=your-openai-key" >> .env.local
   echo "GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key" >> .env.local
   ```

3. **Start the app**
   ```bash
   pnpm dev
   ```

4. **Open the interface**
   Navigate to [http://localhost:3000](http://localhost:3000). The chat window and wiki selector buttons appear immediately.

### Manual Setup (Alternative)

1. **Install main dependencies**
   ```bash
   pnpm install
   ```

2. **Install MCP server dependencies**
   ```bash
   # Lego MCP
   cd mcp-servers/lego && pnpm install && cd ../..

   # Minecraft MCP
   cd mcp-servers/minecraft && pnpm install && cd ../..

   # Pokemon MCP
   cd mcp-servers/pokemon && pnpm install && cd ../..

   # Star Wars MCP
   cd mcp-servers/starwars && pnpm install && cd ../..

   # Wikipedia MCP
   cd mcp-servers/wikipedia && pnpm install && cd ../..

   # Wings of Fire MCP
   cd mcp-servers/wingsoffire && pnpm install && cd ../..
   ```

3. **Configure API keys and start** (same as steps 2-4 above)

---

## Customization & Advanced Topics

### Changing the AI Provider
- The app supports both OpenAI (GPT-5, GPT-5 Mini) and Google (Gemini 2.5 Pro/Flash) models.
- Models are configured in `app/api/chat/route.ts` and can be switched via the model selector in the UI.
- Add the appropriate API keys to `.env.local` for the models you want to use.

### Adding Another Wiki (MediaWiki-based)
1. Duplicate one of the existing MCP server directories (e.g., `mcp-servers/pokemon`) and update the environment variables to target your new wiki's API.
2. Register the server in `lib/mcp/manager.ts` and expose it through `components/mcp-selector.tsx` (add your button image to the public folder).
3. Update the system prompt logic in `app/api/chat/route.ts` to tailor responses for the new topic.
4. Run `pnpm install` in your new MCP server directory to install dependencies.

### Integrating a Custom MCP (TypeScript/Python/Node)
- Follow the structure inside `mcp-servers/minecraft` (TypeScript) or `mcp-servers/wikipedia` (Python) for inspiration.
- Ensure the executable can run via `spawn` with stdio transport.
- After adding the command to `mcp-servers`, register it in the manager and adjust the UI selector accordingly.

---

## Troubleshooting
| Symptom | What to Check |
| --- | --- |
| Missing API key errors | Confirm `OPENAI_API_KEY` and/or `GOOGLE_GENERATIVE_AI_API_KEY` are set in `.env.local` and restart the dev server. |
| "Failed to switch MCP server" error | Run the install script (`./install.sh`) to ensure all MCP dependencies are installed. Check terminal logs for missing binaries or blocked ports. |
| "Cannot find module" errors for MCP servers | Run `./install.sh` or manually install dependencies in each MCP server directory. |
| Wikipedia tool calls fail | Ensure the virtualenv exists and that your machine has outbound HTTPS access. |
| Wiki data not returning | Verify MCP server dependencies are installed with `./install.sh`. Check that the specific MCP server can start by testing the API endpoint. |

---

## Roadmap (Parent-Facing)
- Splash graphics and animations when switching MCP servers.
- Option to choose the underlying AI model directly from the interface.
- MCP-specific "thinking" animations to make waiting more fun.
- Expanded documentation for self-hosting additional MCP servers of any language.

---

## Additional Highlights
- **Chat UI** built with Next.js 15, Tailwind, and shadcn/ui components.
- **Multiple AI models** – Switch between OpenAI GPT-5, GPT-5 Mini, and Google Gemini models.
- **Process manager** that launches the right MCP server for each wiki and restarts them on demand.
- **Context-aware prompts** nudge kids to pick the correct source (e.g., Pokémon questions while Minecraft is active).
- **Markdown responses** render cleanly, including lists, headers, and tables.
- **Easy setup** with automated install script for all dependencies.

---

## Contributing & Feedback
This project is still in its first iteration. Suggestions, bug reports, and family-friendly ideas are welcome—open an issue or send a pull request. If you’re running it with your kids, we’d love to hear what topics they explore next!

---

**Safe browsing, locally powered.**
