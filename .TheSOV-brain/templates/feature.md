---
type: feature
status: planning
unanchored: "no code yet"
blocked_by: []
iterations: 0
---
<!-- This is what `harness new feature` emits, and the two used to disagree:
     the template carried empty `branch:`, `pr:`, `relates_to:` and `tags: []`
     that the command does not write, and lacked the `iterations: 0` the gate
     reads. Somebody comparing them could not tell which was authoritative.

     Empty keys are not documentation. `branch`, `pr`, `relates_to` and `tags`
     are all valid on a feature - add one when it has a value.

     Two are written by the flow rather than by hand, and the gate reads both:
     `critic_reviewed: <date>` before the freeze, and `simulated` before this
     ships - either a date, or `declined: <reason>` when the user was offered a
     simulation and said no. Shipping with `simulated` absent is an error,
     because an empty field afterwards cannot be told apart from an answer of
     no.

     `blocked_by` is what this plan waits on, each a `<repo>/<slug>` - and
     it is the only thing the map, `harness roadmap` and `harness next` call
     a wait; the roadmap's order is intent, not a dependency. `[]` means it
     can run in parallel. The commit gate refuses a feature it adds to a
     roadmap, or creates, without the key. -->

## Problem

## Scope

## Out of scope

## Prior art
<!-- Who already built this, what they all do, where they disagree, what they
     regret - and the verdict: build / build on top / extend / contribute /
     use what exists / investigate first. Load the `prior-art` skill; it is a
     procedure, not a browse.

     "None found, and here is where I looked" is a real answer. An empty
     section is not - it means nobody looked. -->

## Coupling
<!-- What this touches, what it duplicates, what it contradicts. Discovered by
     reading, never assumed. Use a mermaid `flowchart`: it travels everywhere
     the note goes - the console, a pull request, and an agent reading the raw
     text - which is why the diagram lives in the note rather than beside it.

     Greenfield? Say so, and describe the coupling this feature *creates*. -->

## Related
<!-- Other features this belongs with. [[wikilink]] inside this repo;
     `<repo>/<slug>` when it lives in another one - a wikilink cannot cross
     from one repo's vault into another's. -->

## Open questions
<!-- What is still undecided, and what guessing wrong would cost. Parked, not
     dropped: a spec that resolved its gaps by omission cannot be built against,
     because nobody knows which parts were actually decided. Empty is a fine
     answer once everything load-bearing is settled - say so rather than
     deleting the heading. -->

## Decisiones por el camino
<!-- One line per answer the owner gave while the work was being shaped. The
     console reads this section into the plan's history, so the grammar is
     strict and a line that does not match is reported, not skipped:

     - AAAA-MM-DD · <question or subject> → <answer> (<who>; <why>)

     An entry goes on over every indented line under it, nested bullets
     included. Name a milestone as `#id` in the entry and it hangs from that
     milestone. A choice that changes the design is promoted to a `decision`
     note and linked with [[its-slug]]. Empty is fine: delete nothing, add the
     first line when the first answer arrives. -->

## Milestones
- [ ]
<!-- One checkbox per step. Every new step names itself with `#id` on its
     line and lists the files it touches in a `touches:` block - the commit
     gate refuses one that does not. Steps already committed are read as
     they are. `needs #other` is optional: without it the step can start
     now. Open the step with its title in bold - the console draws it in the
     step's box, and the rest of the line is read on demand. Copy this shape
     without the comment's indent:

     - [ ] **What this step leaves done**, and how you will see it #short-id needs #earlier-id

           touches:
             - src/where/it/lands.ts

     A pass may name the commit it read, `security: 2026-10-12 @1a2b3c4`
     (in the header, or under a milestone). `harness land` refuses it when code
     outside the vault changed after that commit, and warns when it names none.
-->

## Verification
<!-- The literal command that proves this works, in a fenced block. Not a
     sentence about testing it - the command itself, so `harness verify` can
     run it.

     Required the moment `status` leaves `planning`: until there is a fenced
     block under this heading, `harness doctor` errors. Left empty on purpose -
     a placeholder command would pass the gate while measuring nothing, which
     is worse than the error. -->

<!-- On shipping, replace `unanchored` with the real `applies_to` taken from the diff. -->
