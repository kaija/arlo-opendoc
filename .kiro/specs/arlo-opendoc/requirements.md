# Requirements Document — arlo-opendoc

## Introduction

arlo-opendoc is a git-based knowledge base for markdown documents, built for people who
already keep their documentation in a git repository and want AI agents to read and write
it safely.

The product's organizing idea is a single equation:

> **session = git worktree = branch = pull request**

Every unit of work happens in an isolated worktree branched from `main`. Uncommitted changes
in that worktree are the review surface — the file tree shows what is new, modified, or
deleted, and the middle panel shows the diff. When the work is done, the session is published
as a pull request. Nothing an agent does can reach `main` without passing through git's
existing review machinery.

Three panels: file tree on the left, document preview/editor/diff in the middle, agent chat
on the right. Sessions are browser-style tabs across the top.

**V1 is the desktop application** (macOS and Windows, Rust + Tauri + Next.js). The hosted web
service is specified in Requirements 20–24 and is explicitly deferred to V2; it is documented
now so that V1 architecture does not foreclose it.

### Scope boundaries

| In scope for V1 | Deferred to V2 | Out of scope |
| --- | --- | --- |
| Desktop app, macOS + Windows | Hosted web service | Mobile applications |
| GitHub pull requests | GitLab / Gitea forges | Real-time multi-user co-editing |
| Markdown + plain-text indexing | PDF / DOCX extraction | Rich-text (WYSIWYG) editing |
| Local embeddings | Hosted embeddings | Self-hosted arlo server |
| `claude`, `codex`, `gemini` adapters | Additional CLI adapters | In-app 3-way merge resolution |

### Glossary

| Term | Meaning |
| --- | --- |
| **Workspace** | A registered git repository (plus optional subpath) that arlo manages. |
| **Session** | A unit of work: one git worktree, one branch, one chat history, one eventual PR. |
| **Base index** | The hybrid keyword + vector index built from the workspace's `main` branch. |
| **Adapter** | A pluggable integration that spawns and drives an external agent CLI. |
| **Broker** | The component that holds credentials; callers request operations, never the secret. |
| **Forge** | A git hosting service exposing an HTTP API for pull requests (GitHub, GitLab, …). |

---

## Requirements

### Requirement 1: Workspace registration

**User Story:** As a knowledge worker, I want to connect arlo to my documentation
repository, so that I can browse and search it without leaving the app.

#### Acceptance Criteria

1. WHEN the user supplies a git remote URL THEN the system SHALL clone it to an
   application-managed location and register it as a workspace.
2. WHEN the user supplies a path to an existing local clone THEN the system SHALL register
   that clone as a workspace without re-cloning it.
3. WHERE a workspace is registered the system SHALL allow an optional repository subpath, and
   SHALL restrict the file tree, the index, and all agent file access to that subpath.
4. WHEN cloning over SSH THEN the system SHALL use the user's existing SSH agent and
   `~/.ssh/config` without requiring the user to paste a private key into arlo.
5. WHEN cloning over HTTPS THEN the system SHALL use the platform git credential helper.
6. IF authentication fails during clone THEN the system SHALL report which credential
   mechanism was attempted and SHALL NOT report a generic failure.
7. WHEN a workspace is registered THEN the system SHALL detect and record the repository's
   default branch name rather than assuming `main`.
8. THE system SHALL support multiple registered workspaces and SHALL allow the user to
   switch between them.
9. WHEN a workspace's on-disk clone is missing or corrupt at startup THEN the system SHALL
   offer to re-clone it and SHALL NOT crash or silently show an empty tree.

---

### Requirement 2: Session creation

**User Story:** As a user, I want each piece of work isolated from every other, so that an
agent editing one thing cannot disturb anything else.

#### Acceptance Criteria

1. WHEN the user creates a session THEN the system SHALL fetch the remote, SHALL create a
   git worktree from the tip of the workspace's default branch, and SHALL create a new
   branch for that worktree.
2. WHEN generating a session branch name THEN the system SHALL produce a unique, valid
   git ref, and SHALL prefix it with a configurable namespace (default `arlo/`).
3. WHEN session creation begins THEN the system SHALL present the UI within 1 second and
   SHALL show progress for the fetch and checkout rather than blocking on them.
4. IF the fetch fails because the machine is offline THEN the system SHALL create the
   worktree from the last known local tip of the default branch AND SHALL mark the session
   as "created offline — may be behind".
5. IF the working tree of the underlying clone has uncommitted changes THEN the system SHALL
   still create the session worktree successfully, because worktrees are independent.
6. THE system SHALL support at least 20 concurrent sessions per workspace.
7. WHEN the user creates a session from a specific file THEN the system SHALL open that file
   in the preview panel once the worktree is ready.

---

### Requirement 3: Session persistence and lifecycle

**User Story:** As a user, I want work that an agent did yesterday to still be there today,
so that I can trust agents with tasks that take longer than one sitting.

#### Acceptance Criteria

1. WHEN the application exits THEN the system SHALL preserve every session's worktree,
   branch, chat history, and open-file state.
2. WHEN the application restarts THEN the system SHALL restore the previously open session
   tabs and the active session.
3. WHILE a session has uncommitted changes the system SHALL periodically commit them to the
   session branch as WIP commits and SHALL push that branch to the remote.
4. WHERE WIP auto-save is enabled the system SHALL debounce commits so that a burst of agent
   writes produces one WIP commit rather than one per file.
5. WHEN WIP commits are later published THEN the system SHALL offer to squash them so that
   the pull request does not contain auto-save noise.
6. IF the WIP push fails THEN the system SHALL retain the local commits, SHALL surface a
   non-blocking warning, and SHALL retry on the next auto-save interval.
7. WHEN a session has been idle for longer than the configured retention period
   (default 30 days) THEN the system SHALL warn the user before removing its worktree.
8. WHEN a session's worktree is removed by garbage collection THEN the system SHALL retain
   the branch on the remote so that no committed work is lost.
9. WHEN a session's worktree is missing but its branch exists THEN the system SHALL be able
   to rehydrate the worktree from the remote branch.
10. WHEN the user explicitly deletes a session THEN the system SHALL require confirmation,
    SHALL state whether unpushed work exists, and SHALL then remove the worktree and branch.

---

### Requirement 4: File tree with git status

**User Story:** As a user, I want to see at a glance what has changed in this session, so
that I can review an agent's work before publishing it.

#### Acceptance Criteria

1. WHEN a session is active THEN the system SHALL display the file tree of that session's
   worktree.
2. THE system SHALL display every file present in the worktree, including file types arlo
   cannot preview or index.
3. WHERE a file differs from the session's base commit the system SHALL show a status
   indicator distinguishing added, modified, deleted, and renamed files.
4. WHERE a directory contains changed descendants the system SHALL propagate a change
   indicator to that directory, so that changes are discoverable without expanding the tree.
5. THE system SHALL display a count of changed files for the active session.
6. WHEN a file changes on disk by any means THEN the system SHALL update the tree and its
   status indicators within 1 second without user action.
7. WHERE the repository defines ignore rules the system SHALL honour `.gitignore` and SHALL
   additionally honour an `.arloignore` file using the same syntax.
8. WHEN a tree contains more than 1,000 entries in view THEN the system SHALL virtualize
   rendering so that scrolling remains responsive.
9. THE system SHALL provide filename filter-as-you-type over the tree.
10. WHEN the user requests it THEN the system SHALL revert an individual file to its base-commit
    content, and SHALL require confirmation before doing so.

---

### Requirement 5: Document preview

**User Story:** As a reader, I want documents rendered properly, so that arlo is pleasant to
read in and not just to edit in.

#### Acceptance Criteria

1. WHEN the user selects a markdown file THEN the system SHALL render it as formatted
   markdown in the middle panel.
2. THE system SHALL render GitHub Flavored Markdown including tables, task lists,
   strikethrough, and fenced code blocks with syntax highlighting.
3. WHERE a markdown document contains a Mermaid code block the system SHALL render it as a
   diagram.
4. WHERE a markdown document references an image by relative path the system SHALL resolve
   that path against the session worktree and SHALL display the image inline.
5. WHERE a document begins with YAML frontmatter the system SHALL display it as structured
   metadata rather than as document body text.
6. WHEN the user selects an image file THEN the system SHALL display the image.
7. WHEN the user selects a plain-text or source file THEN the system SHALL display it with
   syntax highlighting.
8. WHEN the user selects a file arlo cannot render THEN the system SHALL display a
   placeholder with the file's size and type and an action to reveal it in the OS file manager.
9. WHEN the user activates an internal document link THEN the system SHALL navigate to the
   target file within arlo rather than opening a browser.
10. WHEN the user activates an external link THEN the system SHALL open it in the system
    browser and SHALL NOT navigate the application webview.
11. WHEN rendering any document THEN the system SHALL NOT execute scripts or load remote
    resources embedded in that document.

---

### Requirement 6: Source editing

**User Story:** As a user, I want to fix a typo myself, so that I don't have to ask an AI to
do something that takes two seconds.

#### Acceptance Criteria

1. WHEN the user switches the middle panel to source mode THEN the system SHALL present the
   file's raw text in an editor with markdown syntax highlighting.
2. WHEN the user saves an edited file THEN the system SHALL write the file byte-for-byte as
   shown, and SHALL NOT reformat, reflow, or normalize any markdown the user did not edit.
3. THE system SHALL preserve the file's existing line-ending style and final-newline
   convention on save.
4. WHILE a file has unsaved changes the system SHALL indicate the unsaved state in the UI.
5. WHEN an agent turn is about to begin AND an open buffer has unsaved changes THEN the
   system SHALL save that buffer before the agent runs.
6. WHEN a file changes on disk AND the corresponding buffer has no unsaved changes THEN the
   system SHALL reload the buffer automatically.
7. WHEN a file changes on disk AND the corresponding buffer has unsaved changes THEN the
   system SHALL NOT overwrite the buffer, SHALL notify the user, and SHALL offer to keep the
   buffer, take the disk version, or view the difference.
8. THE system SHALL support creating, renaming, moving, and deleting files and folders within
   the session worktree.
9. THE system SHALL NOT provide rich-text (WYSIWYG) markdown editing in V1.

---

### Requirement 7: Diff review

**User Story:** As a reviewer, I want to see exactly what changed, so that I can approve an
agent's work with confidence.

#### Acceptance Criteria

1. WHEN the user switches the middle panel to diff mode THEN the system SHALL display the
   difference between the file's base-commit content and its current content.
2. THE system SHALL offer both inline (unified) and side-by-side diff presentation.
3. WHERE a file was added the system SHALL present the entire file as added content.
4. WHERE a file was deleted the system SHALL present its base-commit content as removed.
5. WHERE a file is binary the system SHALL state that it changed without attempting a
   textual diff.
6. WHEN the user requests a session-wide review THEN the system SHALL present the combined
   diff of every changed file in the session.
7. WHEN viewing a diff THEN the system SHALL allow reverting an individual hunk.

---

### Requirement 8: Agent permission gate

**User Story:** As a user, I want to approve what an agent changes, so that I stay in control
of my knowledge base.

#### Acceptance Criteria

1. WHEN an agent requests a tool that writes to the filesystem THEN the system SHALL suspend
   the agent and SHALL present an approval prompt naming the tool and the target path.
2. WHERE the requested operation modifies an existing file the approval prompt SHALL show the
   proposed diff before the user decides.
3. WHEN the user approves a request THEN the system SHALL resume the agent and allow the
   operation.
4. WHEN the user denies a request THEN the system SHALL inform the agent of the denial so
   that the agent can adapt rather than fail.
5. WHEN the user selects "always allow" for a tool THEN the system SHALL auto-approve
   subsequent requests for that tool for the remainder of the session.
6. THE system SHALL scope "always allow" to a single session and SHALL NOT carry it into new
   sessions.
7. THE system SHALL display which permissions are currently auto-approved and SHALL allow
   revoking them mid-session.
8. WHEN an approval is pending THEN the system SHALL indicate this on the session's tab so
   that it is visible from any other session.
9. THE system SHALL NOT permit an agent to write outside its own session worktree.
10. IF an agent requests a path outside the session worktree THEN the system SHALL deny the
    request and SHALL record the attempt in the session log.
11. WHEN a session is idle with a pending approval for longer than a configured interval THEN
    the system SHALL raise an OS notification.

---

### Requirement 9: Native agent

**User Story:** As a user, I want to ask questions and request edits in plain language, so
that I can work with my knowledge base conversationally.

#### Acceptance Criteria

1. THE system SHALL provide a chat interface in the right panel, scoped to the active
   session.
2. THE system SHALL implement the native agent as an instance of the `claude` CLI adapter,
   and SHALL NOT maintain a second, separate agent runtime.
3. WHEN the native agent runs THEN the system SHALL render its messages, reasoning, and tool
   calls as native interface elements and SHALL NOT present a terminal emulator.
4. WHEN the agent produces output THEN the system SHALL stream it incrementally rather than
   waiting for turn completion.
5. THE system SHALL set the agent's working directory to the active session's worktree.
6. THE system SHALL provide the agent with file read, directory list, and content grep tools
   scoped to the session worktree, in addition to semantic search.
7. WHEN the agent cites a document THEN the system SHALL render the citation as a link that
   opens that file in the middle panel.
8. THE system SHALL persist chat history per session across application restarts.
9. WHEN the user interrupts a running agent THEN the system SHALL halt it within 2 seconds
   and SHALL leave already-applied file changes in place.
10. WHERE the user has an existing authenticated `claude` installation the system SHALL reuse
    that authentication and SHALL NOT require an API key.
11. IF no agent credentials are available THEN the system SHALL explain how to authenticate
    and SHALL leave browsing, editing, and search fully functional.
12. THE system SHALL bundle a pinned `claude` binary as a sidecar so that the application
    functions without a pre-existing installation.

---

### Requirement 10: Agent CLI adapters

**User Story:** As a user, I want to run my preferred agent CLI inside arlo, so that I am not
locked into one vendor's agent.

#### Acceptance Criteria

1. THE system SHALL define an adapter interface covering: process launch, event stream
   parsing, permission interception, session resume, and cancellation.
2. THE system SHALL require each adapter to declare its capabilities, at minimum whether it
   supports structured events, permission interception, and resume.
3. THE system SHALL ship adapters for `claude`, `codex`, and `gemini`.
4. WHEN an adapter is launched THEN the system SHALL set its working directory to the active
   session worktree.
5. WHEN an adapter is launched THEN the system SHALL inject arlo's session-scoped MCP server
   into that agent's configuration.
6. WHERE an adapter declares permission interception the system SHALL route that agent's tool
   requests through the approval flow in Requirement 8.
7. WHERE an adapter does not declare permission interception the system SHALL display a
   persistent, visible indicator that arlo is not gating that agent's file writes.
8. THE system SHALL detect which supported CLIs are installed and SHALL disable adapters
   whose binary is absent, with an explanation.
9. THE system SHALL record the CLI version an adapter was verified against and SHALL warn
   when the installed version differs by a major version.
10. IF an adapter process exits unexpectedly THEN the system SHALL report the exit status and
    SHALL retain any file changes the agent already made.
11. THE system SHALL support multiple agent conversations within a single session, presented
    as tabs within the right panel.
12. WHEN an adapter process is running THEN the system SHALL indicate this on the session tab.
13. WHEN a session ends THEN the system SHALL terminate every adapter process belonging to it
    and SHALL NOT leave orphaned processes.

---

### Requirement 11: Document indexing

**User Story:** As a user, I want my documents indexed automatically, so that search works
without me maintaining anything.

#### Acceptance Criteria

1. WHEN a workspace is registered THEN the system SHALL begin building an index of its
   default branch without requiring user action.
2. THE system SHALL index markdown and plain-text formats, and SHALL treat source files as
   plain text.
3. THE system SHALL NOT attempt to extract text from PDF, DOCX, or other binary document
   formats in V1.
4. THE system SHALL build the keyword index before the vector index, so that keyword search
   becomes available within seconds of registration.
5. WHILE indexing is in progress the system SHALL display progress and SHALL allow all other
   functionality to be used.
6. THE system SHALL generate embeddings locally on the user's device and SHALL NOT transmit
   document content to any external service for embedding.
7. THE system SHALL use an embedding model that performs acceptably on non-English content,
   including Chinese, Japanese, and Korean.
8. THE system SHALL cache embeddings keyed by git blob hash, so that identical content is
   embedded at most once across branches, worktrees, and re-clones.
9. THE system SHALL record the embedding provider, model identifier, and vector dimension in
   index metadata.
10. IF the configured embedding model differs from the one recorded in index metadata THEN the
    system SHALL rebuild the index rather than mixing incompatible vectors.
11. WHEN the workspace's default branch advances THEN the system SHALL update the index
    incrementally, embedding only files whose blob hash changed.
12. THE system SHALL chunk documents along markdown heading boundaries where possible, and
    SHALL retain each chunk's source path, heading path, and line range.
13. THE system SHALL complete a full index of a 20,000-document repository without exhausting
    memory, using an on-disk vector index.
14. WHEN indexing encounters an unreadable or malformed file THEN the system SHALL skip it,
    SHALL record the reason, and SHALL continue.
15. THE system SHALL expose an action to rebuild a workspace's index from scratch.

---

### Requirement 12: Search

**User Story:** As a user, I want to find the right document whether I remember its wording
or only its meaning, so that search does not fail me in either case.

#### Acceptance Criteria

1. THE system SHALL provide hybrid retrieval combining keyword (BM25) and vector similarity
   results.
2. WHEN a query contains an exact identifier such as an error code, flag, or filename THEN
   keyword matching SHALL ensure it is retrievable.
3. THE system SHALL provide a keyboard-accessible command palette as the primary human search
   entry point.
4. WHEN search results are displayed THEN the system SHALL label each result as a keyword
   match, a semantic match, or both.
5. WHEN a search result is displayed THEN the system SHALL show its file path, heading path,
   and a content excerpt.
6. WHEN the user selects a search result THEN the system SHALL open that file in the middle
   panel scrolled to the matching region.
7. THE system SHALL return results for a 20,000-document index within 500 ms at the 95th
   percentile.
8. THE system SHALL allow filtering search results by directory path.
9. THE system SHALL search the index built from the default branch.
10. WHEN a search result is returned THEN the system SHALL verify the cited content against
    the session worktree before presenting it, and SHALL mark results whose source file has
    changed or been deleted in the session.
11. IF the vector index is still building THEN the system SHALL return keyword results and
    SHALL indicate that semantic results are incomplete.

---

### Requirement 13: MCP server

**User Story:** As a user, I want my other AI tools to reach my knowledge base, so that arlo
is not a walled garden.

#### Acceptance Criteria

1. THE system SHALL run an MCP server accessible over HTTP on the loopback interface only.
2. THE system SHALL expose a distinct MCP endpoint per session, such that the endpoint
   determines which worktree the tools operate on.
3. THE system SHALL require a bearer token per session endpoint and SHALL reject unauthorized
   requests.
4. WHEN a session ends THEN the system SHALL invalidate that session's token and endpoint.
5. THE system SHALL expose tools for: hybrid search, file read, directory listing, content
   grep, file write, and session diff.
6. WHERE an MCP tool writes to the filesystem the system SHALL route the request through the
   approval flow in Requirement 8.
7. THE system SHALL confine every MCP file operation to the session worktree, and SHALL
   reject path traversal outside it.
8. THE system SHALL provide a copyable MCP client configuration snippet for the active
   session.
9. THE system SHALL bind to a port chosen at runtime and SHALL NOT fail to start because a
   fixed port is occupied.
10. THE system SHALL NOT accept connections from non-loopback addresses in V1.

---

### Requirement 14: Publishing a session

**User Story:** As a user, I want to publish my session as a pull request, so that my changes
go through normal review.

#### Acceptance Criteria

1. WHEN the user publishes a session THEN the system SHALL present the full session diff for
   review before anything is pushed.
2. WHEN publishing THEN the system SHALL commit any remaining uncommitted changes to the
   session branch.
3. WHEN publishing THEN the system SHALL offer to squash WIP commits into a single commit.
4. THE system SHALL allow the user to edit the commit message, pull request title, and pull
   request body before submission.
5. THE system SHALL be able to draft the pull request title and body from the session diff
   and chat context, as a suggestion the user may edit.
6. WHERE the remote is a supported forge the system SHALL create a pull request from the
   session branch to the default branch via the forge API.
7. WHERE the remote is not a supported forge the system SHALL push the branch and SHALL
   present a copyable comparison URL.
8. WHEN a pull request has been created THEN the system SHALL display its number, URL, and
   state on the session.
9. THE system SHALL refresh pull request state so that merged and closed sessions are
   distinguishable in the session list.
10. WHEN a session's pull request is merged THEN the system SHALL offer to close the session
    and remove its worktree.
11. IF pull request creation fails due to insufficient token scope THEN the system SHALL name
    the missing scope and SHALL NOT report a generic authorization error.
12. THE system SHALL record in the commit trailer which agent, if any, produced the changes.

---

### Requirement 15: Forge integration

**User Story:** As a user, I want arlo to work with my git host, so that it fits my existing
workflow.

#### Acceptance Criteria

1. THE system SHALL define a forge adapter interface covering: create pull request, read pull
   request state, list branches, and detect the default branch.
2. THE system SHALL implement the GitHub forge adapter for both github.com and GitHub
   Enterprise Server.
3. THE system SHALL authenticate to GitHub using OAuth device flow, and SHALL accept a
   personal access token as an alternative.
4. THE system SHALL store forge credentials in the operating system keychain and SHALL NOT
   write them to plain-text configuration.
5. WHEN a repository remote is inspected THEN the system SHALL detect which forge, if any, it
   belongs to.
6. WHERE no forge adapter matches a remote the system SHALL operate in push-only mode without
   presenting broken pull request affordances.
7. THE system SHALL treat git transport authentication and forge API authentication as
   separate concerns, and SHALL report which one failed.
8. WHEN a forge API request is rate-limited THEN the system SHALL back off and SHALL report
   when the limit resets.

---

### Requirement 16: Branch drift and conflicts

**User Story:** As a user, I want to know when my session has fallen behind, so that I don't
discover conflicts only at merge time.

#### Acceptance Criteria

1. THE system SHALL periodically fetch the default branch and SHALL display how many commits
   each session is behind it.
2. WHEN a session is significantly behind THEN the system SHALL surface a prompt to update it.
3. WHEN the user updates a session THEN the system SHALL rebase the session branch onto the
   current default branch.
4. IF the rebase completes without conflict THEN the system SHALL apply it and SHALL report
   what changed.
5. IF the rebase produces conflicts THEN the system SHALL abort the rebase and SHALL restore
   the session to its exact pre-rebase state.
6. WHEN a rebase is aborted due to conflicts THEN the system SHALL offer the user a choice of:
   resolving on the forge, opening the worktree in an external editor, or asking an agent to
   resolve the conflicts.
7. WHERE an agent attempts conflict resolution the system SHALL present the result as a diff
   for approval before it is committed.
8. THE system SHALL NOT provide an in-app three-way merge conflict editor in V1.
9. WHEN any rebase is performed THEN the system SHALL record the pre-rebase commit so that the
   operation can be undone.
10. WHEN a session's pull request is reported as having conflicts THEN the system SHALL show
    this state on the session.

---

### Requirement 17: Session interface

**User Story:** As a user, I want to move between several pieces of work, so that I can let a
long agent task run while I do something else.

#### Acceptance Criteria

1. THE system SHALL present open sessions as tabs across the top of the window.
2. WHEN the user closes a session tab THEN the system SHALL close the tab only and SHALL NOT
   end, delete, or garbage-collect the session.
3. THE system SHALL provide a session manager listing every session, including those with no
   open tab, showing branch, changed-file count, pull request state, and last activity.
4. WHEN a session requires attention THEN the system SHALL display a badge on its tab
   distinguishing at minimum: agent running, approval pending, and conflicted.
5. WHEN more tabs are open than fit THEN the system SHALL provide overflow navigation without
   truncating tabs into unreadability.
6. THE system SHALL provide keyboard shortcuts for switching between session tabs.
7. WHEN switching sessions THEN the system SHALL restore that session's tree state, open file,
   panel mode, and scroll position.
8. WHEN switching sessions THEN the system SHALL NOT interrupt agent processes running in the
   session being switched away from.
9. THE system SHALL allow the user to rename a session.

---

### Requirement 18: Platform, packaging, and offline behaviour

**User Story:** As a user, I want a normal desktop application, so that it installs, updates,
and behaves like everything else on my machine.

#### Acceptance Criteria

1. THE system SHALL run on macOS (Apple Silicon and Intel) and Windows (x86-64).
2. THE system SHALL be distributed as signed, notarized installers appropriate to each
   platform.
3. THE system SHALL provide in-application update checking.
4. THE system SHALL bundle the embedding model runtime such that no separate installation is
   required.
5. WHILE the machine is offline the system SHALL permit browsing, previewing, editing,
   searching, and local committing.
6. WHILE the machine is offline the system SHALL clearly indicate that fetch, push, and pull
   request operations are unavailable, rather than failing silently.
7. WHEN connectivity is restored THEN the system SHALL resume deferred WIP pushes.
8. THE system SHALL store application data in the platform-conventional application data
   directory.
9. THE system SHALL implement its user interface against a transport-agnostic client
   interface, so that the same interface code can be served by a remote backend without
   modification.
10. THE system SHALL handle repository paths containing spaces and non-ASCII characters on
    both platforms.

---

### Requirement 19: Security and privacy

**User Story:** As a security-conscious user, I want to know my documents stay on my machine,
so that I can use arlo for confidential material.

#### Acceptance Criteria

1. THE system SHALL NOT transmit document content to any third party except as part of an
   explicit agent request initiated by the user.
2. THE system SHALL generate all embeddings locally and SHALL NOT transmit document content
   for indexing.
3. THE system SHALL store all credentials in the operating system keychain.
4. THE system SHALL NOT write credentials, tokens, or document content to log files.
5. THE system SHALL restrict every agent and MCP file operation to the active session
   worktree.
6. THE system SHALL treat document content as untrusted data, and SHALL NOT act on
   instructions embedded within documents that an agent reads.
7. WHEN a document an agent has read contains text directed at the agent THEN the system
   SHALL NOT permit that text to bypass the permission gate in Requirement 8.
8. THE system SHALL sanitize rendered markdown so that embedded scripts do not execute and
   remote resources are not fetched.
9. THE system SHALL maintain a per-session activity log of file operations and agent actions,
   viewable by the user.
10. THE system SHALL verify the integrity of the bundled agent CLI sidecar before executing it.

---

## Deferred to V2 — Hosted web service

The following requirements define the hosted web service. They are recorded so that V1
architecture accommodates them. **They are not in V1 scope.**

### Requirement 20: Web authentication and access control

#### Acceptance Criteria

1. THE web service SHALL authenticate users via SSO.
2. THE web service SHALL serve only repositories an administrator has explicitly registered,
   and SHALL NOT expose repositories merely because the service account can reach them.
3. THE web service SHALL map SSO groups to per-repository read and write permission.
4. WHEN a user lacks permission for a repository THEN the web service SHALL NOT reveal its
   existence.
5. THE web service SHALL provide an administrative interface for repository registration and
   group mapping.
6. THE web service SHALL maintain an audit log recording SSO identity, repository, action, and
   timestamp.

### Requirement 21: Web commit attribution

#### Acceptance Criteria

1. WHEN the web service creates a commit THEN it SHALL set the git author to the
   authenticated user's name and email.
2. WHEN the web service creates a commit THEN it SHALL set the git committer to the service
   account.
3. WHEN the web service creates a commit THEN it SHALL include a trailer identifying the
   authenticated actor and the agent involved.
4. WHEN the web service opens a pull request THEN it SHALL name the requesting user in the
   pull request body.

### Requirement 22: Web credential isolation

#### Acceptance Criteria

1. THE web service SHALL hold the git service account credential in a secret store.
2. THE web service SHALL mediate all git operations through a broker process, such that no
   agent process can read the credential.
3. THE web service SHALL NOT expose the git credential in any agent-reachable environment
   variable, file, or process.
4. THE web service SHALL scope every session's filesystem access to that session's worktree.

### Requirement 23: Web agent execution

#### Acceptance Criteria

1. THE web service SHALL execute agents in a per-session sandbox.
2. THE web service SHALL disable shell execution and arbitrary command tools for agents.
3. THE web service SHALL restrict agent tools to arlo's own MCP surface.
4. THE web service SHALL NOT support spawning arbitrary user-specified agent CLIs.
5. THE web service SHALL prevent sandboxed agents from reaching cloud instance metadata
   endpoints and internal network ranges.

### Requirement 24: Web usage metering and limits

#### Acceptance Criteria

1. THE web service SHALL meter model token usage per user and per organization.
2. THE web service SHALL enforce a hard per-session token ceiling and SHALL terminate an agent
   that exceeds it.
3. THE web service SHALL enforce configurable per-user and per-organization quotas.
4. THE web service SHALL display remaining quota to the user.
5. WHEN a quota is exhausted THEN the web service SHALL disable agent features while leaving
   browsing and search available.
6. THE web service SHALL expose usage data suitable for per-seat billing, with payment
   integration delivered as a subsequent milestone.

---

## Non-functional requirements

| ID | Category | Requirement |
| --- | --- | --- |
| NFR-1 | Startup | Application window interactive within 2 s on a warm start. |
| NFR-2 | Session creation | UI responsive within 1 s; checkout progresses asynchronously. |
| NFR-3 | Tree update | Filesystem change reflected in tree within 1 s. |
| NFR-4 | Search latency | p95 under 500 ms on a 20,000-document index. |
| NFR-5 | Index throughput | Full index of 20,000 documents completes without memory exhaustion. |
| NFR-6 | Scale | 20,000 documents / 2 GB repository / 20 concurrent sessions. |
| NFR-7 | Installer size | Under 400 MB per platform including the bundled model and CLI sidecar. |
| NFR-8 | Memory | Under 1.5 GB resident with 5 sessions open on a 20,000-document workspace. |
| NFR-9 | Data safety | No user-authored content is lost by any single application crash. |
| NFR-10 | Accessibility | Full keyboard navigation; WCAG AA contrast for status indicators. |
| NFR-11 | Internationalization | UTF-8 paths and content; CJK content indexed and searchable. |
| NFR-12 | Observability | Structured local logs, redacted of credentials and document content. |
