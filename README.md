# ia-agent-core

`ia-agent-core` is a personal project I'm building with **Node.js and TypeScript** while learning about artificial intelligence and coding agents.

The idea is to create an agent that can work on a local project, read and modify files, run commands, and use different AI models.

This is not a finished project and it is not meant to compete with other coding agent tools. I'm mainly building it to understand how these systems work internally and to experiment with different ideas.

## What does it currently do?

* Agent loop based on **ReAct**.
* Read and modify files.
* Run commands through the terminal.
* Project-specific memory using `.ia/`.
* Support for different AI providers.
* Context limits for files and terminal output.
* `doctor` command to check the configuration.

## Project memory

One of the ideas I'm experimenting with is giving each project its own memory.

A project can contain a `.ia/` folder:

```text
.ia/
├── rules.md
├── style.md
├── architecture.md
└── lessons.md
```

These files can contain things such as project rules, coding style, architecture information, or problems that have been found before.

The goal is for the agent to adapt to the project it is working on instead of always using the same context.

## AI providers

The project uses a Factory so the AI provider can be changed without having to modify the main agent logic.

Currently I'm testing:

* Gemini
* OpenRouter

I may add more providers in the future.

## Context

To avoid large files or long terminal outputs taking up the entire model context, there is currently a limit of **3000 characters** for file reads and terminal output.

Files inside `.ia/` are not affected by this limit.

I still want to improve this part by adding ways to search inside files or read only specific parts when needed.

## Architecture

I'm trying to keep the agent logic separate from the interface that uses it.

For now, the main interface is a CLI, but the core uses callbacks so it does not depend directly on the CLI. The idea is to be able to reuse the core from other interfaces in the future, such as a possible VS Code extension.

```text
              CLI
               |
           Callbacks
               |
               v
        Agent Engine
         ReAct Loop
          /      \
         /        \
        v          v
     Tools      LLM Factory
       |         /       \
       |        /         \
    Files   Gemini     OpenRouter
    Terminal
```

## Security

Since the agent works directly with the project and can run commands, I've added some basic protections:

* Protection against `path traversal`.
* Real path checks to help prevent escapes through symbolic links.
* Blocking access to some sensitive files.
* Restrictions on certain potentially destructive commands.

This is **not a sandbox**. Commands are executed with the permissions of the user running the agent. The current protections are simply a first layer of security.

## Current status

The project is still under development.

Some of the things I want to work on next are:

* Improve context management.
* Add file search and partial file reading.
* Improve the memory system.
* Add a command for importing coding style rules from a file.
* Add more providers and models.
* Look into ways to isolate agent execution.
* Create a VS Code extension.

## Installation

```bash
git clone https://github.com/TU_USUARIO/ia-agent-core.git
cd ia-agent-core
npm install
npm run build
npm link
```

It can then be used from any project:

```bash
ia-agent "Review this project and tell me what you would improve"
```

You can also check the configuration with:

```bash
ia-agent doctor
```

## Why did I make this?

I'm learning about software development and artificial intelligence, and I wanted to understand better how coding agents actually work.

Instead of only using existing tools, I decided to try building one myself.

Through this project I'm learning about working with LLMs, designing an agent loop, creating tools that allow the model to interact with files and the terminal, managing context, and thinking about the security problems that appear when a program can modify a real project.

The project will probably change quite a lot as I learn more. That's part of the point.

## Technologies

* TypeScript
* Node.js
* Gemini
* OpenRouter
* LLMs
* ReAct

## License

MIT
