# ia-agent-core

`ia-agent-core` is a personal project I'm building with **Node.js and TypeScript** while learning about artificial intelligence and coding agents.

The idea is to build an agent that can work on a local project, read and modify files, run commands, and work with different AI providers.

This is not a finished project and it's not intended to compete with existing coding agent tools. I'm mainly building it to understand how these systems work internally and to experiment with different approaches.

## What does it currently do?

* Agent loop based on **ReAct**.
* Read and modify project files.
* Run commands through the terminal.
* Project-specific memory using `.ia/`.
* Support for multiple AI providers.
* Basic limits for file reads and terminal output.
* `doctor` command to check the configuration.
* Basic token and context usage metrics.

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

The project uses a Factory so the AI provider can be changed without modifying the main agent logic.

Currently I'm working with:

* Gemini
* OpenRouter

More providers may be added in the future.

## Context

The agent currently limits file reads and terminal output to **3000 characters** to avoid unnecessarily large inputs.

Files inside `.ia/` are not affected by this limit.

This is still an area I'm working on. One of the next steps is to make context usage more efficient by allowing the agent to search files and read only the parts it actually needs.

The project now also keeps basic metrics about token usage and context growth between iterations. I'm using these metrics to understand how much context the agent is actually consuming before making further optimizations.

## Architecture

I'm trying to keep the agent logic separate from the interface that uses it.

For now, the main interface is a CLI, but the core uses callbacks so it does not depend directly on the CLI. The idea is to reuse the core from other interfaces in the future, such as a possible VS Code extension.

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

This is **not a sandbox**. Commands are executed with the permissions of the user running the agent.

The current protections are only a first layer of security and there is still work to do in this area.

## Current status

The project is currently a **functional prototype under active development**.

The basic agent loop and tools are working, but many parts of the project are still experimental and may change as I learn more.

Some of the things I want to work on next are:

* Improve context management and reduce unnecessary token usage.
* Add file search and partial file reading.
* Improve the project memory system.
* Add a command for importing coding style rules from a file.
* Add more providers and models.
* Look into better ways to isolate agent execution.
* Create a VS Code extension.

## Installation

```bash
git clone https://github.com/IPM746/AgenTIA.git
cd AgenTIA
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
