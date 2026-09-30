# Prompts

Prompts that changed the **Three.js app** (`react-app`). Tutorials, glossaries, Git, and planning notes are left out. Copy new app prompts to the bottom.

---

## 2026-09-02

### Cube + overlay
Let's create a three.js as a main window of our application. This should be an interactive canvas with orbit camera and lets display a cube in the center of the screen. Lets include a react UI with website title and a minimialistic panel for sliders in the future.

### Blob
lets change the cube in the center of the screen into a 3D shaped blob with the same settings from prior

### Halloween
make it halloween theme with a ghost in the center

### Live sliders
allow me to adjust the sliders and expand on the minimal panel

### Apply style guide
update the app using `Style Guide.md`

---

## 2026-09-09

### Pixel cube
Let's create a three.js as a main window of our application. This should be an interactive canvas with orbit camera and lets display a pixel cube in the center of the screen. Lets include a react UI with website title and a minimialistic panel for sliders in the future.

### Localhost
the local host is http://localhost:5173

### Pixel cube on 5173
Now let's try to create a three.js as a main window of our application. This should be an interactive canvas with orbit camera and lets display a pixel cube in the center of the screen. Lets include a react UI with website title and a minimialistic panel for sliders in the future.

### 3D / 2D noise terrain
Create a menu that allows me to switch between 3D and 2D showing 3D noise terrain: a rotatable 3D grid shaped by simplex noise plus a small 2D black-and-white view of the raw noise pattern. Add sliders for zoom, height, layers, and grid detail, plus a dropdown with various noise options, each with its own slider. Use a real noise library, not random numbers.

### Hydraulic erosion sim
In the 2d view, let's create a simulation tab, that allows me to create a hydraulic erosion simulation over the 2d simplex noise, including a start and stop button for the simulation, as well as all the necessary sliders to control the parameters of the simulation. Include a way of reseting the simulation

### Accent + heightmap color
change my orange accent to red and apply that pallette to my height map to be from blue to red

### Color split 2D / 3D
change the 2d field back to what it was, apply the blue to red color pallette to the 3d view itself

### Grayscale heightmap, solid 3D mesh
want the heightmap to be grayscale again but make the 3d mesh not wireframe so the colors show

---

## 2026-09-23

### Voxels terrain tab
lets create a new tab named voxels terrain that implements the different density shapes (marching cubes, ray marching, point, etc.)

### Voxels from 3D field (Minecraft-style)
instead of the voxels being completely disassicoated from my field made in 2d and 3d, have them relate to each other where when i click on the voxels tab it creates a seperate field where it turns my field made in 3d into voxels, more minecraft style, not entirely shape focused but pixel focused. and being able to adjust how each voxel bleeds into each other

---

## 2026-09-29

### Real density grid, then meshing
Right now my voxels tab just makes a mesh from noise, there is no real voxel grid behind it. Please change this so it works in two steps: first, make a 3D grid of voxels where each voxel stores a density number from a 3D function density(x, y, z) and then I am able to modify the voxel terrain with various different meshing techniques

### Only Marching Cubes + Interactive
Within the Voxels tab, in the Meshing "Mode" dropdown, remove all options except two: "Marching Cubes" and "Interactive". Delete the code paths for any other modes so they don't run or get selected. Make sure the UI still defaults sensibly to one of these two modes on load, and that switching between them doesn't break the voxel grid underneath (both modes should read from the same density grid).

### Interactive: greedy mesh, height gradient, edit
within the voxels tab, for the "Interactive" mode, build a blocky voxel renderer on top of the existing density grid, with a stylized twist instead of the standard Minecraft look: only generate cube faces where the neighboring voxel is air (face culling), merge adjacent faces of the same orientation into larger quads (greedy meshing) to keep triangle count low, and color each face using a smooth height-based gradient — deep blue at the lowest elevations transitioning through the spectrum up to red at the highest peaks. Add one directional light plus soft ambient light for flat shading, and add basic editing so clicking a face removes that voxel and shift-clicking adds one adjacent to the clicked face. Keep this fully separate from Marching Cubes, reading the same density grid but producing this distinct blocky, gradient-colored, face-culled, greedy-meshed mesh.

### Custom height gradient editor
in the voxels tab, add a gradient editor UI so I can define my own height-based color gradient instead of a hardcoded one. Let me add multiple color stops (each with a color and a position from 0 to 1 representing relative height), reorder or remove stops, and see a live preview strip of the gradient. Use this custom gradient to color the Interactive mode voxel faces based on height, interpolating smoothly between whatever stops I've set (so two stops = a simple two-color blend, three+ stops = a multi-color gradient). Store the current gradient in state so it persists while adjusting other sliders, and default it to blue (position 0) to red (position 1) if no custom gradient has been set yet.

### Edge falloff / thin surface crust
within the voxels tab, the Interactive mode renders as one solid cube with hard, flat vertical walls at the edges, it looks like a block of terrain rather than a landscape. Let's change the density/terrain generation so it fades out naturally at the edges of the grid instead of cutting off sharply: apply a falloff mask that reduces density smoothly as it approaches the grid boundary (e.g. based on distance from center, or an edge-falloff function), so voxels near the edges become sparser and eventually empty rather than forming a flat solid wall. Also reduce the amount of solid, blocky "fill" beneath the visible terrain surface — right now it's a filled cube all the way down; instead only generate voxels near the terrain surface itself, so the bottom and sides look like natural eroding terrain (like a mountain range trailing off) rather than a giant colored block.

### Fix falloff cube shell
The edge falloff broke the terrain generation, instead of fading naturally at the boundaries, I now have a solid, flat-walled cube shell with the actual terrain only visible carved into a small area at the top, like a solid block with a hole cut into it. Please fix this: the falloff should only reduce density gradually as voxels approach the edge of the grid, not create a solid enclosing shell or invert which areas are solid vs empty. The result should look like natural terrain (hills/mountains) that tapers off at the edges, with no flat cube walls anywhere, and the interior should not be hollow — solid ground should extend underneath the terrain surface, just fading out near the horizontal edges, not the top.

### Remove cube shell
remove the cube shell

### Voxels as 3D heightfield terrain
use the same idea as the field from the 3d tab and take that same idea and apply that to the voxels tab and make the voxels as a terrain field

### Infinite chunk streaming
Make the terrain generate infinitely instead of being limited to one fixed grid. Split the world into chunks (each chunk being a resolution³ voxel grid using the same density function), and dynamically generate and load new chunks around the camera as it moves, unloading or disposing chunks that get too far away to save memory. Use the camera's world position each frame (or on a throttled interval) to determine which chunk coordinates should currently be loaded, generate density and mesh data only for those chunks, and make sure noise/density sampling uses consistent world-space coordinates (not per-chunk local coordinates) so terrain features line up seamlessly across chunk borders with no visible seams or repeats. Keep the same meshing mode (Interactive/Marching Cubes), height gradient coloring, and edge-fade behavior working per-chunk, but apply edge fade only at the outer boundary of generated chunks, not at every individual chunk's edge, so it feels like one continuous, endless world in every direction.

### Dark / red control panel UI
Please redesign the control panel UI with a dark and red look: (1) Make the sliders look custom, not the plain browser style, dark track, red fill, and a red handle. (2) Change the font on the whole page to something that isn't the plain default font, a cool monospace or techy-looking font. (3) Turn each section (Voxel World, Meshing, Height Gradient, Noise, Field, etc.) into a box that can open and close when you click on it, so I don't have to scroll through everything at once. (4) Keep the background mostly black, text mostly white or light gray, and use red only for buttons, sliders, and active/selected things, so it stands out. Please don't change how anything works — just how it looks.

### IBM Plex Mono + bolder titles/tabs
change the font to IBM Plex Mono and make section title slightly bolded and then same thing for the 3D/2D/Voxels tabs (make those slightly bolded)

### Martian Mono + bolder still
change font to Martian Mono and make the sections titles and tabs bolder, not bold enough

### Nested labels smaller / section headers larger
Reduce the font size of the nested field labels inside each accordion section — "Mode", "Overlap", "Type", "Lacunarity," and similar — back down to the default/original size (they got too large from a previous change). Keep them at regular/normal font weight as already set.

Increase the font size of the accordion section header labels ("MESHING", "NOISE", "HEIGHT GRADIENT", "VOXEL WORLD", "FIELD", "RAW 2D") slightly — keep them bold as they are now, just bump the size up a bit so they stand out more.

### Accordion chevron tooltips
Add a tooltip to each accordion section's expand/collapse arrow — when hovering over the arrow, show a small popover/tooltip with a short description of what that section does and controls. Position the tooltip so it doesn't get cut off by the panel edge, and keep it lightweight and transparent so the field/screen is shown behind

---

## How to keep this going

After a prompt that changes the Three.js app, paste it here:

```
## YYYY-MM-DD

### Short title
paste the prompt
```
