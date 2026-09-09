# UI / UX terms

A short glossary if you have never taken a UI or UX class. You do not need to memorize this. Skim once, then look a word up when a critique, article, or teammate uses it.

**UI** is what people see and click. **UX** is how the whole experience feels to use. They overlap constantly.

---

## UI vs UX

| Term | Meaning |
|---|---|
| **UI (user interface)** | The visible and interactive layer: screens, buttons, sliders, type, color, layout. |
| **UX (user experience)** | The full experience of using a product: whether it is clear, fast, frustrating, or useful. Includes UI, but also flow, copy, errors, and whether the tool matches the job. |
| **GUI (graphical user interface)** | A UI made of windows, icons, and pointers, as opposed to a command line. Almost every app you use is a GUI. |
| **HCI (human–computer interaction)** | The broader field of how people and computers work together. UI/UX is the design practice inside that field. |

A useful picture:

```
Job the person is trying to do
        ↓
UX (flow, clarity, feedback, mistakes)
        ↓
UI (layout, controls, type, color)
```

---

## People and process

- **User:** the person using the product. Design for them, not for the designer’s taste alone.
- **Persona:** a short, fictional portrait of a typical user (goals, skills, constraints). A reminder, not a real person.
- **Use case / user story:** one job in plain language. Example: “I want to raise the hill height and see the mesh update.”
- **User flow / journey:** the sequence of steps from start to done (open app → change a parameter → see the world change).
- **Information architecture (IA):** how content and tools are grouped and labeled so people can find them.
- **Wireframe:** a low-detail layout sketch. Boxes and labels, not final color or type.
- **Mockup:** a static picture of how the UI might look (Figma, screenshot, still). It does not move.
- **Prototype:** a clickable or coded version you can try. Fidelity = how close it is to the real product.
- **Low-fi / high-fi:** rough vs polished. Low-fi is for structure; high-fi is for look and interaction.
- **Usability:** how easily someone can complete the job without help.
- **User testing:** watching real people try the product. Notes beat opinions.
- **Heuristic evaluation:** checking a UI against known rules of thumb (clarity, feedback, consistency) without a full user study.
- **Iteration:** design, try, change, repeat. First versions are expected to be wrong.

---

## Layout and structure

- **Viewport:** the visible area. In this class, often the 3D canvas that fills the window.
- **Chrome:** the surrounding UI (title bars, panes, toolbars) as opposed to the content. Heavy chrome steals attention from the world.
- **Overlay:** UI drawn on top of the viewport (parameter pane, labels).
- **Layout:** where things sit: left pane vs top bar vs floating panel.
- **Visual hierarchy:** what the eye hits first. Size, contrast, position, and color create it.
- **Grid:** a spacing system (for example 4px) so padding and gaps line up.
- **Alignment:** edges and baselines lining up. Misalignment reads as sloppy even if the idea is good.
- **Whitespace (negative space):** empty space. It is a design tool, not leftover area.
- **Density:** how packed the UI is. Studio tools (TouchDesigner, DAWs) are dense; consumer apps are airy.
- **Above the fold:** what you see without scrolling. Less relevant in a single-screen tool, still used in web critiques.
- **Responsive:** the layout adapts to window or screen size. Not the same as “it works on a phone,” though phones are one case.
- **Breakpoint:** a width where the layout changes (for example desktop vs tablet).
- **Z-order / stacking:** what sits on top of what. The canvas is usually behind; controls sit in front and must still be clickable.
- **Safe area:** space you keep clear of notches, scrollbars, or overlapping panels.

---

## Controls (the pieces you click)

- **Component:** a reusable UI piece (button, slider, row). In React, this is also a code function that returns UI.
- **Control / widget:** an interactive piece that changes a value (slider, number field, toggle).
- **Button:** triggers an action (Reset, Export). Label it with a verb when you can.
- **Icon button:** a button with only an icon. Needs a tooltip if the meaning is not obvious.
- **Input / field:** a box for typing text or numbers.
- **Number box:** a field for a numeric value; often drag or scroll to nudge, like in a DAW.
- **Slider:** a track plus a thumb for a range (0–1, 0–100).
- **Toggle / switch:** on or off.
- **Checkbox:** one option on or off; a group of checkboxes can all be on.
- **Radio button:** pick **one** option from a set.
- **Dropdown / select:** a compact list of choices.
- **Menu:** a list of commands (File, right-click).
- **Context menu:** menu that appears where you clicked, with actions for that thing.
- **Tab:** switches between peer views in the same space.
- **Accordion / disclosure:** a section that expands and collapses.
- **Modal / dialog:** a panel that blocks the rest of the UI until you deal with it. Use sparingly.
- **Popover / dropdown panel:** a small floating panel attached to a control; less blocking than a modal.
- **Tooltip:** short hint on hover or focus. Not for essential instructions.
- **Toast / snackbar:** a brief message that appears and goes away (saved, copied).
- **Scrollbar:** how you move through overflow. Can be styled; should still work.
- **Handle / gripper:** a small target for drag (resize a pane, move a node).
- **Hit area / target size:** the clickable region. Tiny labels are hard to hit; the target can be larger than the drawing.

---

## Interaction and states

- **Affordance:** a cue that something can be used a certain way (a track looks slidable; a row looks clickable).
- **Signifier:** the visible hint of that affordance (a chevron, a raised button, an orange fill).
- **Feedback:** the UI’s reply to an action (value updates, mesh rebuilds, button depresses). No feedback feels broken.
- **State:** how a control looks in a situation. Common states:

| State | Meaning |
|---|---|
| **Default** | Resting, unused |
| **Hover** | Pointer is over it |
| **Focus** | Selected from keyboard (Tab), ready for input |
| **Active / pressed** | Mid-click |
| **Selected** | Chosen among others |
| **Disabled** | Visible but not usable |
| **Error** | Invalid value |
| **Loading** | Waiting on work |

- **Call to action (CTA):** the primary next step on a screen (Save, Generate). A tool with many parameters often has no single CTA; the viewport *is* the action.
- **Direct manipulation:** change the thing itself (drag a vertex, scrub a number) instead of filling a form.
- **Gesture:** click, drag, scroll, pinch, right-click.
- **Shortcut / hotkey:** keyboard equivalent of a click.
- **Cursor / pointer:** the mouse glyph. Changing it (resize, grab) is a signifier.
- **Latency:** delay between action and result. Slow feedback feels like the click failed.
- **Progressive disclosure:** show the simple thing first; reveal advanced options when needed.
- **Onboarding:** first-run teaching. Optional for a class prototype; still useful as a one-line hint.
- **Empty state:** what you show when there is nothing yet (no world generated, no file loaded).
- **Error state:** how the UI explains a failure and how to recover.
- **Confirmation:** “Are you sure?” for destructive actions. Skip it for reversible, cheap actions.

---

## Visual design

- **Typography:** choosing and setting type (family, size, weight, spacing).
- **Typeface / font:** the design of the letters (IBM Plex Mono) vs a file that renders it.
- **Hierarchy (type):** headers vs labels vs hints, usually by size, weight, color, and tracking — not by shouting.
- **Tracking / letter-spacing:** space between letters. Small caps labels often use extra tracking.
- **Leading / line-height:** space between lines.
- **Color palette:** the set of colors you actually use. A tight palette looks intentional.
- **Accent / highlight:** the one loud color for live, selected, or editing (in this project, orange).
- **Contrast:** difference between foreground and background. Low contrast is hard to read.
- **Saturation:** how vivid a color is. Desaturated UI keeps the 3D view in charge.
- **Opacity:** how see-through a layer is. Heavy transparency (glass, blur) fights dense studio UIs.
- **Iconography:** the icon set. Same style, same size, same meaning every time.
- **Consistency:** same pattern for the same job. If sliders work one way, all sliders should.
- **Alignment to a style:** matching a reference (node-based studio vs consumer app) so the UI feels like one product.
- **Fidelity of finish:** polish. Finish late; structure first.

---

## Usability and critique words

These show up in reviews. They are not insults; they name a problem.

- **Discoverability:** can someone find the feature without a tour?
- **Learnability:** how fast a new user becomes competent.
- **Efficiency:** how fast a *returning* user finishes the job. Dense tools optimize this.
- **Cognitive load:** how much the person has to hold in their head. Extra labels, modes, and colors raise it.
- **Mental model:** the user’s private theory of how the tool works. The UI should match it.
- **Mode:** a setting that changes what the same click does (move vs sculpt). Modes surprise people unless they are very obvious.
- **Visibility of system status:** always show what is going on (value, selection, generating…).
- **Mapping:** control vs effect should match (up = more, left pane = parameters for the thing on the right).
- **Constraint:** the UI prevents illegal values (clamped sliders) instead of failing later.
- **Forgiveness:** easy undo, hard to destroy work by accident.
- **Accessibility (a11y):** usable by people with a range of vision, motor, and attention needs. Contrast, focus, labels, and keyboard access are the baseline.
- **Inclusive design:** designing so more people can use it, not only the “average” student with a mouse and a large monitor.
- **ARIA / screen reader:** extra labels in code so assistive software can describe controls. You will meet this in HTML.
- **Touch vs pointer:** fingers are imprecise; hover does not exist on most phones.
- **Dark pattern:** a UI trick that pushes people into something they did not want. Do not use these.
- **Friction:** extra steps. Some friction is good (confirm delete); leftover friction is just slow.

---

## Navigation and information

- **Navigation:** how you move between places in the product.
- **Primary navigation:** the main way around (sidebar, top links). A single-viewport tool may barely have this.
- **Breadcrumb:** a path showing where you are (Home / Project / Terrain).
- **Label:** the text next to a control. Prefer the user’s words (`Height`) over internal names (`dispAmp`).
- **Placeholder:** gray text inside an empty field. It disappears; do not use it as the only label.
- **Helper text / hint:** a small explanation under a control.
- **Copy / microcopy:** the words in the UI. Short, specific, no jokes that hide meaning.
- **Lorem ipsum:** fake filler text. Replace it before you judge the layout.

---

## Product and web extras you will still hear

- **Landing page:** a marketing page. Not the same as the app UI.
- **Dashboard:** a home screen of summaries. Easy to overbuild; this class app may not need one.
- **Card:** a boxed chunk of content. Common on websites; easy to overuse in tools.
- **Hero:** a giant top banner. Fine for marketing; usually wrong inside a studio tool.
- **Fold / scrolljacking:** forcing weird scroll behavior. Avoid it.
- **Design system:** a shared set of components, colors, and rules so screens match. A class **style guide** is a small version of this.
- **Token:** a named value (`--panel`, `--highlight`) so color and type stay consistent in code.
- **Component library:** prebuilt UI pieces (your own, or a kit like a button set).
- **Front end:** the part of the software the user sees (React, CSS). **Back end** is servers and data.
- **Pixel-perfect:** matching a mockup down to the pixel. Aim for it after the layout and interaction are right.

---

## Mini cheat sheet (when you are stuck in a critique)

| If someone says… | They probably mean… |
|---|---|
| “The hierarchy is weak” | I do not know where to look first |
| “Too much chrome” | The UI frame is louder than the content |
| “Poor affordance” | I cannot tell that is clickable or draggable |
| “Needs feedback” | I clicked and nothing obvious happened |
| “Inconsistent” | Two similar things work or look different |
| “High cognitive load” | Too many choices, labels, or modes at once |
| “Low contrast” | Type or controls disappear into the background |
| “Not discoverable” | I would never find that feature |
| “Tight / dense” | Packed like a pro tool; can be good or cramped |
| “Feels consumer” | Too much padding, rounding, or marketing layout for a studio app |

---

## A 10-minute practice (do this)

1. Open any app you already use (Figma, a DAW, this class prototype).
2. Name five **controls** on screen.
3. For one control, list its **states** (default, hover, disabled).
4. Write one **user story** (“I want to … so that …”).
5. Note one **friction** and one piece of **feedback**.

If you can do that, you know enough vocabulary to talk about UI/UX in a review.

---

## When a term still feels fuzzy

Ask which layer they mean:

1. **Job** — what is the person trying to finish?
2. **Flow** — what steps do they take?
3. **UI** — what is on screen, and what happens when they click?

Most arguments mix those three. Separating them makes the next change obvious.
