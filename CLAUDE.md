# CLAUDE.md

## Project Overview

This is **Awesome Generative AI**, a community-curated list of modern Generative AI projects and services. It follows the [awesome list](https://awesome.re) format. The repository is maintained at [steven2358/awesome-generative-ai](https://github.com/steven2358/awesome-generative-ai) and licensed under CC0 1.0 Universal (public domain).

This is a **content-only repository** — there is no source code, build system, test suite, or CI/CD pipeline. All content is written in Markdown.

## Repository Structure

```
README.md          # Main curated list of generative AI projects
DISCOVERIES.md     # Secondary list for up-and-coming/niche projects
ARCHIVE.md         # Inactive/discontinued projects
CONTRIBUTING.md    # Contribution guidelines and quality standards
LICENSE            # CC0 1.0 Universal
```

### File Purposes

- **README.md** — The main list. Projects here must have significant following (1,000+ followers/users) or be of particular interest to the maintainer. This is the primary deliverable of the repository.
- **DISCOVERIES.md** — A showcase for projects that don't meet main list criteria but are still valuable or innovative. Mirrors the same category structure as the main list.
- **ARCHIVE.md** — Projects that are no longer active in generative AI. When a project shuts down or becomes inactive, move its entry here.
- **CONTRIBUTING.md** — Defines formatting rules, quality standards, and inclusion criteria.

## Content Categories

Both README.md and DISCOVERIES.md use the same category hierarchy:

```
- Recommended reading (+ Milestones subsection)
- Text
  - Models, Chatbots, Custom interfaces, Search engines,
    Local search engines, Writing assistants, ChatGPT extensions,
    Productivity, Meeting assistants, Academia, Leaderboards,
    Other text generators
- Coding
  - Coding Assistants, Developer tools, Playgrounds, Local LLM Deployment
- Agents
  - Autonomous agents, Custom assistants
- Image
  - Models, Services, Graphic design, Image libraries,
    Model libraries, Stable Diffusion resources
- Video (+ Avatars, Animation subsections)
- Audio
  - Text-to-speech, Speech-to-text, Music
- Other
- Learning resources
- More lists (+ Lists on ChatGPT subsection)
```

## Entry Format and Conventions

### Standard entry format

```markdown
- [ProjectName](https://example.com/) - Concise description ending with a period.
```

### Key formatting rules

1. **Use the exact format**: `[ProjectName](Link) - Description.`
2. **Add new entries to the bottom** of their respective category/subsection.
3. **Descriptions must be concise, clear, and end with a period.**
4. **Remove trailing whitespace** from all lines.
5. **Open source tagging**: Append `#opensource` at the end for open source projects. If the open source repo URL differs from the main link, format as: `[#opensource](https://github.com/org/repo)`.
6. **Milestone entries** follow a different format: `[Name](link) - Description. Source, Date.`

### Examples

Standard entry:
```markdown
- [ToolName](https://tool.example.com/) - A tool that does X for Y. #opensource
```

Entry with separate open source link:
```markdown
- [ToolName](https://tool.example.com/) - A tool that does X for Y. [#opensource](https://github.com/org/tool)
```

Milestone entry:
```markdown
- [EventName](https://link.example.com/) - Description of the milestone event. Source Name, Month Day, Year.
```

## Quality Standards for Entries

All projects should be:
- **Widely used** and useful to the community
- **Actively maintained** (at minimum, addressing open issues)
- **Well-documented**

### Inclusion criteria for main list (README.md)

A project must meet at least one of:
1. High general interest with 1,000+ followers/users
2. Personally interesting to the maintainer

### Inclusion criteria for Discoveries list (DISCOVERIES.md)

Projects that don't meet the main list criteria but are still valuable, unique, or innovative contributions to generative AI.

### Archive criteria (ARCHIVE.md)

Projects that have shut down, been abandoned, or are no longer active in generative AI.

## Common Tasks

### Adding a new entry

1. Determine the correct file: README.md (established, popular) vs DISCOVERIES.md (newer, niche).
2. Find the appropriate category and subsection.
3. Add the entry at the **bottom** of that subsection.
4. Use the exact format: `- [Name](URL) - Description.`
5. Ensure no trailing whitespace.

### Moving an entry between lists

- **Promoting** from DISCOVERIES.md to README.md: Remove from DISCOVERIES.md, add to the matching section in README.md (at bottom of subsection).
- **Archiving**: Remove from README.md or DISCOVERIES.md, add to ARCHIVE.md.

### Adding a new category

New categories or improvements to existing ones are welcome. Ensure the category is added to the Table of Contents (`## Contents`) section at the top of the file.

## Known Issues in Current Content

- There is a malformed link in README.md line 158: `[OpenRouter LLM Rankings][https://openrouter.ai/rankings]` uses square brackets instead of parentheses for the URL.
- There is a malformed link in README.md line 186: `[RooCode][https://github.com/RooCodeInc/Roo-Code]` uses square brackets instead of parentheses for the URL.
- There is a malformed link in DISCOVERIES.md line 67: `[https://...](AI Summary Helper)` has the URL and text reversed.
- Fireflies.ai appears twice in the Meeting assistants section of README.md (lines 138 and 140).

## Working with This Repository

- **No build or test commands** — this is a pure Markdown curation project.
- **Validation** is manual: check that links use correct Markdown syntax, descriptions end with periods, entries are in the right category, and there is no trailing whitespace.
- **Pull requests** should target the `main` branch on GitHub.
- Contributions are accepted via pull requests or issues at the GitHub repository.
