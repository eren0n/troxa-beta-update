# Qwen Image 2

> Qwen-Image-2.0 is a next-generation foundational unified generation-and-editing model


## Overview

- **Endpoint**: `https://fal.run/fal-ai/qwen-image-2/pro/text-to-image`
- **Model ID**: `fal-ai/qwen-image-2/pro/text-to-image`
- **Category**: text-to-image
- **Kind**: inference
**Tags**: realism, typography



## Pricing

- **Price**: $0.075 per images

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_):
  Text prompt describing the desired image. Supports Chinese and English;.
  - Examples: "# 1930s Luxury Automobile Manufacturing – 11-Stage Infographic\n## LAYOUT\n- 3 rows, flowchart with arrows left→right, curving down between rows\n- Row 1: Stages 1–3 | Row 2: Stages 4–6 | Row 3: Stages 7–11\n- Style: hand-drawn sketch, watercolor coloring. Car color: deep burgundy/cream accents\n- Car style: 1930s grand tourer (long hood, flowing fenders, wire wheels, art deco chrome)\n---\n## ROW 1\n### STAGE 1 – DESIGN & COACHBUILDING PLANNING\n- Isometric design studio with wooden drafting tables\n- 3 designers in waistcoats: one drawing side-profile with French curves, one sculpting a cream clay scale model on turntable, one reviewing a full-size blueprint on wall\n- Art Deco posters on walls, inkwells, callipers, blackboard with chassis dimensions\n### STAGE 2 – SUPPLY CHAIN & RAW MATERIALS\n- Components spread out with label lines:\n  - **STEEL INGOTS & BILLETS** – dark gray blocks, warm foundry glow\n  - **ALUMINUM SHEETS** – silver sheets on wooden pallet\n  - **ASH WOOD TIMBER** – honey-brown planks bundled (for body frame)\n  - **LEATHER HIDES** – rolled cognac-brown full-grain hides\n  - **WIRE SPOKES & HUB CASTINGS** – bundled steel spokes, gray castings\n  - **GLASS PANES** – transparent sheets in straw-packed crates\n  - **CHROME & BRASS FITTINGS** – shiny strips, handles, hood ornament blanks\n- Background: foundry/tannery silhouettes with smoking chimneys\n### STAGE 3 – PART FABRICATION (METALWORK & WOODWORK)\nTwo bordered sub-boxes:\n**Top – \"METALWORK & FORGING\":**\nSteel billets → **DROP FORGE** (hammer press, glowing orange part) → **PRECISION LATHE** (belt-driven, machinist in flat cap) → **HAND GAUGING** (micrometers, go/no-go gauges on wooden bench)\n**Bottom – \"COACHWORK FRAME & PANEL BEATING\":**\n**ASH CUTTING** (bandsaw, sawdust) → **FRAME JIG ASSEMBLY** (skeletal wooden body on jig, car shape visible) → **HAND PANEL BEATING** (craftsman hammering aluminum over wooden buck) → **ENGLISH WHEEL** (rolling panel for smooth curves)\n---\n## ROW 2\n### STAGE 4 – CHASSIS & MECHANICAL ASSEMBLY\n- **LADDER CHASSIS** – dark steel twin rails + cross-members on trestles, riveted. Workers fitting braces\n- **FRONT AXLE & LEAF SPRINGS** – beam axle with semi-elliptic springs, worker with wrench\n- **REAR AXLE & DIFFERENTIAL** – live axle with pumpkin-shaped housing\n- **DRUM BRAKES** – cable-operated assemblies at each wheel position\n- **STEERING GEARBOX** – worm-and-sector box, drag link to front axle\n### STAGE 5 – ENGINE BUILDING & INSTALLATION\n- Left: **ENGINE BENCH** – inline-8 block (dark green/gray), forged crankshaft being lowered in, pistons in a row, twin brass carburetors, magneto ignition, cylinder head being torqued. Oil cans, rags, hand tools\n- Right: **ENGINE DROP-IN** – completed engine lowered by chain hoist on A-frame crane into chassis. Two workers guiding. Transmission bell housing visible\n### STAGE 6 – BODY MOUNTING\n- Bare aluminum body shell (silver, on wooden frame) lowered by overhead gantry onto rolling chassis\n- 4–5 workers guiding body down. Red alignment lines between mount points\n- Labels: \"Body mount bolts\", \"Firewall alignment\", \"Running board brackets\"\n- Full car silhouette now recognizable: long hood, set-back cabin, swept tail\n---\n## ROW 3\n### STAGE 7 – PAINTING & FINISHING\n- Painter in white coveralls spraying with gun: gray primer on rear half, deep burgundy lacquer on front half\n- Second worker wet-sanding between coats\n- Labels: \"Lead filler & primer\", \"Nitrocellulose lacquer\", \"Hand rubbing & polishing\"\n### STAGE 8 – INTERIOR TRIMMING\n- Cabin cutaway showing: hand-stitched diamond-tufted cognac leather seats, burled walnut dashboard with round gauge holes and chrome bezels, leather door panels with chrome cranks, dark maroon wool carpet, cream cloth headliner\n### STAGE 9 – CHROME & BRIGHTWORK\n- Vignettes: chrome bumpers bolted on, art deco hood ornament (leaping figurine) on radiator cap, round chrome headlamps on fenders, tall vertical-bar radiator grille, trim strips and door handles. Worker polishing fender to mirror shine\n### STAGE 10 – MECHANICAL TESTING\n- Completed burgundy car with cream fenders and full chrome\n- Labels: \"Ignition timing & carburetor tuning\" (mechanic with timing light), \"Brake balance test\", \"Wheel alignment\" (string method), \"Electrical check\" (lights glowing), \"Fluid fill & leak check\"\n- Handwritten checklist on clipboard resting on fender\n### STAGE 11 – ROAD TEST & DELIVERY\n- Left: car in motion on country road, dust trail, driver in goggles/leather cap. Green hills in watercolor background\n- Right: car at Art Deco showroom entrance. Factory director in three-piece suit, client in top hat receiving leather key fob, chauffeur in uniform by driver's door\n---\n## STYLE GUIDE\n- **Colors:** Burgundy body (#6B1024), cream accents (#F5E6C8), dark steel chassis, silver aluminum, honey-brown ash wood, cognac leather, bright chrome highlights\n- **Typography:** Bold uppercase sans-serif titles (\"STAGE [#] – [NAME]\"), smaller labels with thin connector lines\n- **Style:** Ink outlines, watercolor flat fill, isometric/3/4 view, period-correct details (belt-driven machines, chain hoists, flat caps, Art Deco flourishes)\n- **Arrows:** Thin black, left→right, curving down between rows\n- **Proportions:** Landscape ~3:1, 3 equal rows, Stage 3 taller, Row 3 has 5 narrower stages"

- **`negative_prompt`** (`string`, _optional_):
  Content to avoid in the generated image. Max 500 characters. Default value: `""`
  - Default: `""`
  - Examples: "low resolution, error, worst quality, low quality, deformed"

- **`image_size`** (`ImageSize | Enum`, _optional_):
  The size of the generated image. Total number of pixels must be between 512x512 and 2048x2048. Default value: `square_hd`
  - Default: `"square_hd"`
  - One of: ImageSize | Enum
  - Examples: {"width":2048,"height":2048}

- **`enable_prompt_expansion`** (`boolean`, _optional_):
  Enable LLM prompt optimization for better results. Default value: `true`
  - Default: `true`

- **`seed`** (`integer`, _optional_):
  Random seed for reproducibility (0-2147483647).

- **`enable_safety_checker`** (`boolean`, _optional_):
  Enable content moderation for input and output. Default value: `true`
  - Default: `true`

- **`sync_mode`** (`boolean`, _optional_):
  If `True`, the media will be returned as a data URI and the output data won't be available in the request history.
  - Default: `false`

- **`num_images`** (`integer`, _optional_):
  The number of images to generate. Default value: `1`
  - Default: `1`
  - Range: `1` to `4`

- **`output_format`** (`OutputFormatEnum`, _optional_):
  The format of the generated image. Default value: `"png"`
  - Default: `"png"`
  - Options: `"jpeg"`, `"png"`, `"webp"`



**Required Parameters Example**:

```json
{
  "prompt": "# 1930s Luxury Automobile Manufacturing – 11-Stage Infographic\n## LAYOUT\n- 3 rows, flowchart with arrows left→right, curving down between rows\n- Row 1: Stages 1–3 | Row 2: Stages 4–6 | Row 3: Stages 7–11\n- Style: hand-drawn sketch, watercolor coloring. Car color: deep burgundy/cream accents\n- Car style: 1930s grand tourer (long hood, flowing fenders, wire wheels, art deco chrome)\n---\n## ROW 1\n### STAGE 1 – DESIGN & COACHBUILDING PLANNING\n- Isometric design studio with wooden drafting tables\n- 3 designers in waistcoats: one drawing side-profile with French curves, one sculpting a cream clay scale model on turntable, one reviewing a full-size blueprint on wall\n- Art Deco posters on walls, inkwells, callipers, blackboard with chassis dimensions\n### STAGE 2 – SUPPLY CHAIN & RAW MATERIALS\n- Components spread out with label lines:\n  - **STEEL INGOTS & BILLETS** – dark gray blocks, warm foundry glow\n  - **ALUMINUM SHEETS** – silver sheets on wooden pallet\n  - **ASH WOOD TIMBER** – honey-brown planks bundled (for body frame)\n  - **LEATHER HIDES** – rolled cognac-brown full-grain hides\n  - **WIRE SPOKES & HUB CASTINGS** – bundled steel spokes, gray castings\n  - **GLASS PANES** – transparent sheets in straw-packed crates\n  - **CHROME & BRASS FITTINGS** – shiny strips, handles, hood ornament blanks\n- Background: foundry/tannery silhouettes with smoking chimneys\n### STAGE 3 – PART FABRICATION (METALWORK & WOODWORK)\nTwo bordered sub-boxes:\n**Top – \"METALWORK & FORGING\":**\nSteel billets → **DROP FORGE** (hammer press, glowing orange part) → **PRECISION LATHE** (belt-driven, machinist in flat cap) → **HAND GAUGING** (micrometers, go/no-go gauges on wooden bench)\n**Bottom – \"COACHWORK FRAME & PANEL BEATING\":**\n**ASH CUTTING** (bandsaw, sawdust) → **FRAME JIG ASSEMBLY** (skeletal wooden body on jig, car shape visible) → **HAND PANEL BEATING** (craftsman hammering aluminum over wooden buck) → **ENGLISH WHEEL** (rolling panel for smooth curves)\n---\n## ROW 2\n### STAGE 4 – CHASSIS & MECHANICAL ASSEMBLY\n- **LADDER CHASSIS** – dark steel twin rails + cross-members on trestles, riveted. Workers fitting braces\n- **FRONT AXLE & LEAF SPRINGS** – beam axle with semi-elliptic springs, worker with wrench\n- **REAR AXLE & DIFFERENTIAL** – live axle with pumpkin-shaped housing\n- **DRUM BRAKES** – cable-operated assemblies at each wheel position\n- **STEERING GEARBOX** – worm-and-sector box, drag link to front axle\n### STAGE 5 – ENGINE BUILDING & INSTALLATION\n- Left: **ENGINE BENCH** – inline-8 block (dark green/gray), forged crankshaft being lowered in, pistons in a row, twin brass carburetors, magneto ignition, cylinder head being torqued. Oil cans, rags, hand tools\n- Right: **ENGINE DROP-IN** – completed engine lowered by chain hoist on A-frame crane into chassis. Two workers guiding. Transmission bell housing visible\n### STAGE 6 – BODY MOUNTING\n- Bare aluminum body shell (silver, on wooden frame) lowered by overhead gantry onto rolling chassis\n- 4–5 workers guiding body down. Red alignment lines between mount points\n- Labels: \"Body mount bolts\", \"Firewall alignment\", \"Running board brackets\"\n- Full car silhouette now recognizable: long hood, set-back cabin, swept tail\n---\n## ROW 3\n### STAGE 7 – PAINTING & FINISHING\n- Painter in white coveralls spraying with gun: gray primer on rear half, deep burgundy lacquer on front half\n- Second worker wet-sanding between coats\n- Labels: \"Lead filler & primer\", \"Nitrocellulose lacquer\", \"Hand rubbing & polishing\"\n### STAGE 8 – INTERIOR TRIMMING\n- Cabin cutaway showing: hand-stitched diamond-tufted cognac leather seats, burled walnut dashboard with round gauge holes and chrome bezels, leather door panels with chrome cranks, dark maroon wool carpet, cream cloth headliner\n### STAGE 9 – CHROME & BRIGHTWORK\n- Vignettes: chrome bumpers bolted on, art deco hood ornament (leaping figurine) on radiator cap, round chrome headlamps on fenders, tall vertical-bar radiator grille, trim strips and door handles. Worker polishing fender to mirror shine\n### STAGE 10 – MECHANICAL TESTING\n- Completed burgundy car with cream fenders and full chrome\n- Labels: \"Ignition timing & carburetor tuning\" (mechanic with timing light), \"Brake balance test\", \"Wheel alignment\" (string method), \"Electrical check\" (lights glowing), \"Fluid fill & leak check\"\n- Handwritten checklist on clipboard resting on fender\n### STAGE 11 – ROAD TEST & DELIVERY\n- Left: car in motion on country road, dust trail, driver in goggles/leather cap. Green hills in watercolor background\n- Right: car at Art Deco showroom entrance. Factory director in three-piece suit, client in top hat receiving leather key fob, chauffeur in uniform by driver's door\n---\n## STYLE GUIDE\n- **Colors:** Burgundy body (#6B1024), cream accents (#F5E6C8), dark steel chassis, silver aluminum, honey-brown ash wood, cognac leather, bright chrome highlights\n- **Typography:** Bold uppercase sans-serif titles (\"STAGE [#] – [NAME]\"), smaller labels with thin connector lines\n- **Style:** Ink outlines, watercolor flat fill, isometric/3/4 view, period-correct details (belt-driven machines, chain hoists, flat caps, Art Deco flourishes)\n- **Arrows:** Thin black, left→right, curving down between rows\n- **Proportions:** Landscape ~3:1, 3 equal rows, Stage 3 taller, Row 3 has 5 narrower stages"
}
```

**Full Example**:

```json
{
  "prompt": "# 1930s Luxury Automobile Manufacturing – 11-Stage Infographic\n## LAYOUT\n- 3 rows, flowchart with arrows left→right, curving down between rows\n- Row 1: Stages 1–3 | Row 2: Stages 4–6 | Row 3: Stages 7–11\n- Style: hand-drawn sketch, watercolor coloring. Car color: deep burgundy/cream accents\n- Car style: 1930s grand tourer (long hood, flowing fenders, wire wheels, art deco chrome)\n---\n## ROW 1\n### STAGE 1 – DESIGN & COACHBUILDING PLANNING\n- Isometric design studio with wooden drafting tables\n- 3 designers in waistcoats: one drawing side-profile with French curves, one sculpting a cream clay scale model on turntable, one reviewing a full-size blueprint on wall\n- Art Deco posters on walls, inkwells, callipers, blackboard with chassis dimensions\n### STAGE 2 – SUPPLY CHAIN & RAW MATERIALS\n- Components spread out with label lines:\n  - **STEEL INGOTS & BILLETS** – dark gray blocks, warm foundry glow\n  - **ALUMINUM SHEETS** – silver sheets on wooden pallet\n  - **ASH WOOD TIMBER** – honey-brown planks bundled (for body frame)\n  - **LEATHER HIDES** – rolled cognac-brown full-grain hides\n  - **WIRE SPOKES & HUB CASTINGS** – bundled steel spokes, gray castings\n  - **GLASS PANES** – transparent sheets in straw-packed crates\n  - **CHROME & BRASS FITTINGS** – shiny strips, handles, hood ornament blanks\n- Background: foundry/tannery silhouettes with smoking chimneys\n### STAGE 3 – PART FABRICATION (METALWORK & WOODWORK)\nTwo bordered sub-boxes:\n**Top – \"METALWORK & FORGING\":**\nSteel billets → **DROP FORGE** (hammer press, glowing orange part) → **PRECISION LATHE** (belt-driven, machinist in flat cap) → **HAND GAUGING** (micrometers, go/no-go gauges on wooden bench)\n**Bottom – \"COACHWORK FRAME & PANEL BEATING\":**\n**ASH CUTTING** (bandsaw, sawdust) → **FRAME JIG ASSEMBLY** (skeletal wooden body on jig, car shape visible) → **HAND PANEL BEATING** (craftsman hammering aluminum over wooden buck) → **ENGLISH WHEEL** (rolling panel for smooth curves)\n---\n## ROW 2\n### STAGE 4 – CHASSIS & MECHANICAL ASSEMBLY\n- **LADDER CHASSIS** – dark steel twin rails + cross-members on trestles, riveted. Workers fitting braces\n- **FRONT AXLE & LEAF SPRINGS** – beam axle with semi-elliptic springs, worker with wrench\n- **REAR AXLE & DIFFERENTIAL** – live axle with pumpkin-shaped housing\n- **DRUM BRAKES** – cable-operated assemblies at each wheel position\n- **STEERING GEARBOX** – worm-and-sector box, drag link to front axle\n### STAGE 5 – ENGINE BUILDING & INSTALLATION\n- Left: **ENGINE BENCH** – inline-8 block (dark green/gray), forged crankshaft being lowered in, pistons in a row, twin brass carburetors, magneto ignition, cylinder head being torqued. Oil cans, rags, hand tools\n- Right: **ENGINE DROP-IN** – completed engine lowered by chain hoist on A-frame crane into chassis. Two workers guiding. Transmission bell housing visible\n### STAGE 6 – BODY MOUNTING\n- Bare aluminum body shell (silver, on wooden frame) lowered by overhead gantry onto rolling chassis\n- 4–5 workers guiding body down. Red alignment lines between mount points\n- Labels: \"Body mount bolts\", \"Firewall alignment\", \"Running board brackets\"\n- Full car silhouette now recognizable: long hood, set-back cabin, swept tail\n---\n## ROW 3\n### STAGE 7 – PAINTING & FINISHING\n- Painter in white coveralls spraying with gun: gray primer on rear half, deep burgundy lacquer on front half\n- Second worker wet-sanding between coats\n- Labels: \"Lead filler & primer\", \"Nitrocellulose lacquer\", \"Hand rubbing & polishing\"\n### STAGE 8 – INTERIOR TRIMMING\n- Cabin cutaway showing: hand-stitched diamond-tufted cognac leather seats, burled walnut dashboard with round gauge holes and chrome bezels, leather door panels with chrome cranks, dark maroon wool carpet, cream cloth headliner\n### STAGE 9 – CHROME & BRIGHTWORK\n- Vignettes: chrome bumpers bolted on, art deco hood ornament (leaping figurine) on radiator cap, round chrome headlamps on fenders, tall vertical-bar radiator grille, trim strips and door handles. Worker polishing fender to mirror shine\n### STAGE 10 – MECHANICAL TESTING\n- Completed burgundy car with cream fenders and full chrome\n- Labels: \"Ignition timing & carburetor tuning\" (mechanic with timing light), \"Brake balance test\", \"Wheel alignment\" (string method), \"Electrical check\" (lights glowing), \"Fluid fill & leak check\"\n- Handwritten checklist on clipboard resting on fender\n### STAGE 11 – ROAD TEST & DELIVERY\n- Left: car in motion on country road, dust trail, driver in goggles/leather cap. Green hills in watercolor background\n- Right: car at Art Deco showroom entrance. Factory director in three-piece suit, client in top hat receiving leather key fob, chauffeur in uniform by driver's door\n---\n## STYLE GUIDE\n- **Colors:** Burgundy body (#6B1024), cream accents (#F5E6C8), dark steel chassis, silver aluminum, honey-brown ash wood, cognac leather, bright chrome highlights\n- **Typography:** Bold uppercase sans-serif titles (\"STAGE [#] – [NAME]\"), smaller labels with thin connector lines\n- **Style:** Ink outlines, watercolor flat fill, isometric/3/4 view, period-correct details (belt-driven machines, chain hoists, flat caps, Art Deco flourishes)\n- **Arrows:** Thin black, left→right, curving down between rows\n- **Proportions:** Landscape ~3:1, 3 equal rows, Stage 3 taller, Row 3 has 5 narrower stages",
  "negative_prompt": "low resolution, error, worst quality, low quality, deformed",
  "image_size": {
    "width": 2048,
    "height": 2048
  },
  "enable_prompt_expansion": true,
  "enable_safety_checker": true,
  "num_images": 1,
  "output_format": "png"
}
```


### Output Schema

The API returns the following output format:

- **`images`** (`list<File>`, _required_):
  Generated images
  - Array of File
  - Examples: [{"url":"https://v3b.fal.media/files/b/0a90b238/SBKPCfmygQb1BivJjt6Ck_zvpXi8Qy.png"}]

- **`seed`** (`integer`, _required_):
  The seed used for generation
  - Examples: 42



**Example Response**:

```json
{
  "images": [
    {
      "url": "https://v3b.fal.media/files/b/0a90b238/SBKPCfmygQb1BivJjt6Ck_zvpXi8Qy.png"
    }
  ],
  "seed": 42
}
```


## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/fal-ai/qwen-image-2/pro/text-to-image \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "# 1930s Luxury Automobile Manufacturing – 11-Stage Infographic\n## LAYOUT\n- 3 rows, flowchart with arrows left→right, curving down between rows\n- Row 1: Stages 1–3 | Row 2: Stages 4–6 | Row 3: Stages 7–11\n- Style: hand-drawn sketch, watercolor coloring. Car color: deep burgundy/cream accents\n- Car style: 1930s grand tourer (long hood, flowing fenders, wire wheels, art deco chrome)\n---\n## ROW 1\n### STAGE 1 – DESIGN & COACHBUILDING PLANNING\n- Isometric design studio with wooden drafting tables\n- 3 designers in waistcoats: one drawing side-profile with French curves, one sculpting a cream clay scale model on turntable, one reviewing a full-size blueprint on wall\n- Art Deco posters on walls, inkwells, callipers, blackboard with chassis dimensions\n### STAGE 2 – SUPPLY CHAIN & RAW MATERIALS\n- Components spread out with label lines:\n  - **STEEL INGOTS & BILLETS** – dark gray blocks, warm foundry glow\n  - **ALUMINUM SHEETS** – silver sheets on wooden pallet\n  - **ASH WOOD TIMBER** – honey-brown planks bundled (for body frame)\n  - **LEATHER HIDES** – rolled cognac-brown full-grain hides\n  - **WIRE SPOKES & HUB CASTINGS** – bundled steel spokes, gray castings\n  - **GLASS PANES** – transparent sheets in straw-packed crates\n  - **CHROME & BRASS FITTINGS** – shiny strips, handles, hood ornament blanks\n- Background: foundry/tannery silhouettes with smoking chimneys\n### STAGE 3 – PART FABRICATION (METALWORK & WOODWORK)\nTwo bordered sub-boxes:\n**Top – \"METALWORK & FORGING\":**\nSteel billets → **DROP FORGE** (hammer press, glowing orange part) → **PRECISION LATHE** (belt-driven, machinist in flat cap) → **HAND GAUGING** (micrometers, go/no-go gauges on wooden bench)\n**Bottom – \"COACHWORK FRAME & PANEL BEATING\":**\n**ASH CUTTING** (bandsaw, sawdust) → **FRAME JIG ASSEMBLY** (skeletal wooden body on jig, car shape visible) → **HAND PANEL BEATING** (craftsman hammering aluminum over wooden buck) → **ENGLISH WHEEL** (rolling panel for smooth curves)\n---\n## ROW 2\n### STAGE 4 – CHASSIS & MECHANICAL ASSEMBLY\n- **LADDER CHASSIS** – dark steel twin rails + cross-members on trestles, riveted. Workers fitting braces\n- **FRONT AXLE & LEAF SPRINGS** – beam axle with semi-elliptic springs, worker with wrench\n- **REAR AXLE & DIFFERENTIAL** – live axle with pumpkin-shaped housing\n- **DRUM BRAKES** – cable-operated assemblies at each wheel position\n- **STEERING GEARBOX** – worm-and-sector box, drag link to front axle\n### STAGE 5 – ENGINE BUILDING & INSTALLATION\n- Left: **ENGINE BENCH** – inline-8 block (dark green/gray), forged crankshaft being lowered in, pistons in a row, twin brass carburetors, magneto ignition, cylinder head being torqued. Oil cans, rags, hand tools\n- Right: **ENGINE DROP-IN** – completed engine lowered by chain hoist on A-frame crane into chassis. Two workers guiding. Transmission bell housing visible\n### STAGE 6 – BODY MOUNTING\n- Bare aluminum body shell (silver, on wooden frame) lowered by overhead gantry onto rolling chassis\n- 4–5 workers guiding body down. Red alignment lines between mount points\n- Labels: \"Body mount bolts\", \"Firewall alignment\", \"Running board brackets\"\n- Full car silhouette now recognizable: long hood, set-back cabin, swept tail\n---\n## ROW 3\n### STAGE 7 – PAINTING & FINISHING\n- Painter in white coveralls spraying with gun: gray primer on rear half, deep burgundy lacquer on front half\n- Second worker wet-sanding between coats\n- Labels: \"Lead filler & primer\", \"Nitrocellulose lacquer\", \"Hand rubbing & polishing\"\n### STAGE 8 – INTERIOR TRIMMING\n- Cabin cutaway showing: hand-stitched diamond-tufted cognac leather seats, burled walnut dashboard with round gauge holes and chrome bezels, leather door panels with chrome cranks, dark maroon wool carpet, cream cloth headliner\n### STAGE 9 – CHROME & BRIGHTWORK\n- Vignettes: chrome bumpers bolted on, art deco hood ornament (leaping figurine) on radiator cap, round chrome headlamps on fenders, tall vertical-bar radiator grille, trim strips and door handles. Worker polishing fender to mirror shine\n### STAGE 10 – MECHANICAL TESTING\n- Completed burgundy car with cream fenders and full chrome\n- Labels: \"Ignition timing & carburetor tuning\" (mechanic with timing light), \"Brake balance test\", \"Wheel alignment\" (string method), \"Electrical check\" (lights glowing), \"Fluid fill & leak check\"\n- Handwritten checklist on clipboard resting on fender\n### STAGE 11 – ROAD TEST & DELIVERY\n- Left: car in motion on country road, dust trail, driver in goggles/leather cap. Green hills in watercolor background\n- Right: car at Art Deco showroom entrance. Factory director in three-piece suit, client in top hat receiving leather key fob, chauffeur in uniform by driver's door\n---\n## STYLE GUIDE\n- **Colors:** Burgundy body (#6B1024), cream accents (#F5E6C8), dark steel chassis, silver aluminum, honey-brown ash wood, cognac leather, bright chrome highlights\n- **Typography:** Bold uppercase sans-serif titles (\"STAGE [#] – [NAME]\"), smaller labels with thin connector lines\n- **Style:** Ink outlines, watercolor flat fill, isometric/3/4 view, period-correct details (belt-driven machines, chain hoists, flat caps, Art Deco flourishes)\n- **Arrows:** Thin black, left→right, curving down between rows\n- **Proportions:** Landscape ~3:1, 3 equal rows, Stage 3 taller, Row 3 has 5 narrower stages"
   }'
```

### Python

Ensure you have the Python client installed:

```bash
pip install fal-client
```

Then use the API client to make requests:

```python
import fal_client

def on_queue_update(update):
    if isinstance(update, fal_client.InProgress):
        for log in update.logs:
           print(log["message"])

result = fal_client.subscribe(
    "fal-ai/qwen-image-2/pro/text-to-image",
    arguments={
        "prompt": "# 1930s Luxury Automobile Manufacturing – 11-Stage Infographic
    ## LAYOUT
    - 3 rows, flowchart with arrows left→right, curving down between rows
    - Row 1: Stages 1–3 | Row 2: Stages 4–6 | Row 3: Stages 7–11
    - Style: hand-drawn sketch, watercolor coloring. Car color: deep burgundy/cream accents
    - Car style: 1930s grand tourer (long hood, flowing fenders, wire wheels, art deco chrome)
    ---
    ## ROW 1
    ### STAGE 1 – DESIGN & COACHBUILDING PLANNING
    - Isometric design studio with wooden drafting tables
    - 3 designers in waistcoats: one drawing side-profile with French curves, one sculpting a cream clay scale model on turntable, one reviewing a full-size blueprint on wall
    - Art Deco posters on walls, inkwells, callipers, blackboard with chassis dimensions
    ### STAGE 2 – SUPPLY CHAIN & RAW MATERIALS
    - Components spread out with label lines:
      - **STEEL INGOTS & BILLETS** – dark gray blocks, warm foundry glow
      - **ALUMINUM SHEETS** – silver sheets on wooden pallet
      - **ASH WOOD TIMBER** – honey-brown planks bundled (for body frame)
      - **LEATHER HIDES** – rolled cognac-brown full-grain hides
      - **WIRE SPOKES & HUB CASTINGS** – bundled steel spokes, gray castings
      - **GLASS PANES** – transparent sheets in straw-packed crates
      - **CHROME & BRASS FITTINGS** – shiny strips, handles, hood ornament blanks
    - Background: foundry/tannery silhouettes with smoking chimneys
    ### STAGE 3 – PART FABRICATION (METALWORK & WOODWORK)
    Two bordered sub-boxes:
    **Top – \"METALWORK & FORGING\":**
    Steel billets → **DROP FORGE** (hammer press, glowing orange part) → **PRECISION LATHE** (belt-driven, machinist in flat cap) → **HAND GAUGING** (micrometers, go/no-go gauges on wooden bench)
    **Bottom – \"COACHWORK FRAME & PANEL BEATING\":**
    **ASH CUTTING** (bandsaw, sawdust) → **FRAME JIG ASSEMBLY** (skeletal wooden body on jig, car shape visible) → **HAND PANEL BEATING** (craftsman hammering aluminum over wooden buck) → **ENGLISH WHEEL** (rolling panel for smooth curves)
    ---
    ## ROW 2
    ### STAGE 4 – CHASSIS & MECHANICAL ASSEMBLY
    - **LADDER CHASSIS** – dark steel twin rails + cross-members on trestles, riveted. Workers fitting braces
    - **FRONT AXLE & LEAF SPRINGS** – beam axle with semi-elliptic springs, worker with wrench
    - **REAR AXLE & DIFFERENTIAL** – live axle with pumpkin-shaped housing
    - **DRUM BRAKES** – cable-operated assemblies at each wheel position
    - **STEERING GEARBOX** – worm-and-sector box, drag link to front axle
    ### STAGE 5 – ENGINE BUILDING & INSTALLATION
    - Left: **ENGINE BENCH** – inline-8 block (dark green/gray), forged crankshaft being lowered in, pistons in a row, twin brass carburetors, magneto ignition, cylinder head being torqued. Oil cans, rags, hand tools
    - Right: **ENGINE DROP-IN** – completed engine lowered by chain hoist on A-frame crane into chassis. Two workers guiding. Transmission bell housing visible
    ### STAGE 6 – BODY MOUNTING
    - Bare aluminum body shell (silver, on wooden frame) lowered by overhead gantry onto rolling chassis
    - 4–5 workers guiding body down. Red alignment lines between mount points
    - Labels: \"Body mount bolts\", \"Firewall alignment\", \"Running board brackets\"
    - Full car silhouette now recognizable: long hood, set-back cabin, swept tail
    ---
    ## ROW 3
    ### STAGE 7 – PAINTING & FINISHING
    - Painter in white coveralls spraying with gun: gray primer on rear half, deep burgundy lacquer on front half
    - Second worker wet-sanding between coats
    - Labels: \"Lead filler & primer\", \"Nitrocellulose lacquer\", \"Hand rubbing & polishing\"
    ### STAGE 8 – INTERIOR TRIMMING
    - Cabin cutaway showing: hand-stitched diamond-tufted cognac leather seats, burled walnut dashboard with round gauge holes and chrome bezels, leather door panels with chrome cranks, dark maroon wool carpet, cream cloth headliner
    ### STAGE 9 – CHROME & BRIGHTWORK
    - Vignettes: chrome bumpers bolted on, art deco hood ornament (leaping figurine) on radiator cap, round chrome headlamps on fenders, tall vertical-bar radiator grille, trim strips and door handles. Worker polishing fender to mirror shine
    ### STAGE 10 – MECHANICAL TESTING
    - Completed burgundy car with cream fenders and full chrome
    - Labels: \"Ignition timing & carburetor tuning\" (mechanic with timing light), \"Brake balance test\", \"Wheel alignment\" (string method), \"Electrical check\" (lights glowing), \"Fluid fill & leak check\"
    - Handwritten checklist on clipboard resting on fender
    ### STAGE 11 – ROAD TEST & DELIVERY
    - Left: car in motion on country road, dust trail, driver in goggles/leather cap. Green hills in watercolor background
    - Right: car at Art Deco showroom entrance. Factory director in three-piece suit, client in top hat receiving leather key fob, chauffeur in uniform by driver's door
    ---
    ## STYLE GUIDE
    - **Colors:** Burgundy body (#6B1024), cream accents (#F5E6C8), dark steel chassis, silver aluminum, honey-brown ash wood, cognac leather, bright chrome highlights
    - **Typography:** Bold uppercase sans-serif titles (\"STAGE [#] – [NAME]\"), smaller labels with thin connector lines
    - **Style:** Ink outlines, watercolor flat fill, isometric/3/4 view, period-correct details (belt-driven machines, chain hoists, flat caps, Art Deco flourishes)
    - **Arrows:** Thin black, left→right, curving down between rows
    - **Proportions:** Landscape ~3:1, 3 equal rows, Stage 3 taller, Row 3 has 5 narrower stages"
    },
    with_logs=True,
    on_queue_update=on_queue_update,
)
print(result)
```

### JavaScript

Ensure you have the JavaScript client installed:

```bash
npm install --save @fal-ai/client
```

Then use the API client to make requests:

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/qwen-image-2/pro/text-to-image", {
  input: {
    prompt: "# 1930s Luxury Automobile Manufacturing – 11-Stage Infographic
  ## LAYOUT
  - 3 rows, flowchart with arrows left→right, curving down between rows
  - Row 1: Stages 1–3 | Row 2: Stages 4–6 | Row 3: Stages 7–11
  - Style: hand-drawn sketch, watercolor coloring. Car color: deep burgundy/cream accents
  - Car style: 1930s grand tourer (long hood, flowing fenders, wire wheels, art deco chrome)
  ---
  ## ROW 1
  ### STAGE 1 – DESIGN & COACHBUILDING PLANNING
  - Isometric design studio with wooden drafting tables
  - 3 designers in waistcoats: one drawing side-profile with French curves, one sculpting a cream clay scale model on turntable, one reviewing a full-size blueprint on wall
  - Art Deco posters on walls, inkwells, callipers, blackboard with chassis dimensions
  ### STAGE 2 – SUPPLY CHAIN & RAW MATERIALS
  - Components spread out with label lines:
    - **STEEL INGOTS & BILLETS** – dark gray blocks, warm foundry glow
    - **ALUMINUM SHEETS** – silver sheets on wooden pallet
    - **ASH WOOD TIMBER** – honey-brown planks bundled (for body frame)
    - **LEATHER HIDES** – rolled cognac-brown full-grain hides
    - **WIRE SPOKES & HUB CASTINGS** – bundled steel spokes, gray castings
    - **GLASS PANES** – transparent sheets in straw-packed crates
    - **CHROME & BRASS FITTINGS** – shiny strips, handles, hood ornament blanks
  - Background: foundry/tannery silhouettes with smoking chimneys
  ### STAGE 3 – PART FABRICATION (METALWORK & WOODWORK)
  Two bordered sub-boxes:
  **Top – \"METALWORK & FORGING\":**
  Steel billets → **DROP FORGE** (hammer press, glowing orange part) → **PRECISION LATHE** (belt-driven, machinist in flat cap) → **HAND GAUGING** (micrometers, go/no-go gauges on wooden bench)
  **Bottom – \"COACHWORK FRAME & PANEL BEATING\":**
  **ASH CUTTING** (bandsaw, sawdust) → **FRAME JIG ASSEMBLY** (skeletal wooden body on jig, car shape visible) → **HAND PANEL BEATING** (craftsman hammering aluminum over wooden buck) → **ENGLISH WHEEL** (rolling panel for smooth curves)
  ---
  ## ROW 2
  ### STAGE 4 – CHASSIS & MECHANICAL ASSEMBLY
  - **LADDER CHASSIS** – dark steel twin rails + cross-members on trestles, riveted. Workers fitting braces
  - **FRONT AXLE & LEAF SPRINGS** – beam axle with semi-elliptic springs, worker with wrench
  - **REAR AXLE & DIFFERENTIAL** – live axle with pumpkin-shaped housing
  - **DRUM BRAKES** – cable-operated assemblies at each wheel position
  - **STEERING GEARBOX** – worm-and-sector box, drag link to front axle
  ### STAGE 5 – ENGINE BUILDING & INSTALLATION
  - Left: **ENGINE BENCH** – inline-8 block (dark green/gray), forged crankshaft being lowered in, pistons in a row, twin brass carburetors, magneto ignition, cylinder head being torqued. Oil cans, rags, hand tools
  - Right: **ENGINE DROP-IN** – completed engine lowered by chain hoist on A-frame crane into chassis. Two workers guiding. Transmission bell housing visible
  ### STAGE 6 – BODY MOUNTING
  - Bare aluminum body shell (silver, on wooden frame) lowered by overhead gantry onto rolling chassis
  - 4–5 workers guiding body down. Red alignment lines between mount points
  - Labels: \"Body mount bolts\", \"Firewall alignment\", \"Running board brackets\"
  - Full car silhouette now recognizable: long hood, set-back cabin, swept tail
  ---
  ## ROW 3
  ### STAGE 7 – PAINTING & FINISHING
  - Painter in white coveralls spraying with gun: gray primer on rear half, deep burgundy lacquer on front half
  - Second worker wet-sanding between coats
  - Labels: \"Lead filler & primer\", \"Nitrocellulose lacquer\", \"Hand rubbing & polishing\"
  ### STAGE 8 – INTERIOR TRIMMING
  - Cabin cutaway showing: hand-stitched diamond-tufted cognac leather seats, burled walnut dashboard with round gauge holes and chrome bezels, leather door panels with chrome cranks, dark maroon wool carpet, cream cloth headliner
  ### STAGE 9 – CHROME & BRIGHTWORK
  - Vignettes: chrome bumpers bolted on, art deco hood ornament (leaping figurine) on radiator cap, round chrome headlamps on fenders, tall vertical-bar radiator grille, trim strips and door handles. Worker polishing fender to mirror shine
  ### STAGE 10 – MECHANICAL TESTING
  - Completed burgundy car with cream fenders and full chrome
  - Labels: \"Ignition timing & carburetor tuning\" (mechanic with timing light), \"Brake balance test\", \"Wheel alignment\" (string method), \"Electrical check\" (lights glowing), \"Fluid fill & leak check\"
  - Handwritten checklist on clipboard resting on fender
  ### STAGE 11 – ROAD TEST & DELIVERY
  - Left: car in motion on country road, dust trail, driver in goggles/leather cap. Green hills in watercolor background
  - Right: car at Art Deco showroom entrance. Factory director in three-piece suit, client in top hat receiving leather key fob, chauffeur in uniform by driver's door
  ---
  ## STYLE GUIDE
  - **Colors:** Burgundy body (#6B1024), cream accents (#F5E6C8), dark steel chassis, silver aluminum, honey-brown ash wood, cognac leather, bright chrome highlights
  - **Typography:** Bold uppercase sans-serif titles (\"STAGE [#] – [NAME]\"), smaller labels with thin connector lines
  - **Style:** Ink outlines, watercolor flat fill, isometric/3/4 view, period-correct details (belt-driven machines, chain hoists, flat caps, Art Deco flourishes)
  - **Arrows:** Thin black, left→right, curving down between rows
  - **Proportions:** Landscape ~3:1, 3 equal rows, Stage 3 taller, Row 3 has 5 narrower stages"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);
```


## Additional Resources

### Documentation

- [Model Playground](https://fal.ai/models/fal-ai/qwen-image-2/pro/text-to-image)
- [API Documentation](https://fal.ai/models/fal-ai/qwen-image-2/pro/text-to-image/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/qwen-image-2/pro/text-to-image)

### fal.ai Platform

- [Platform Documentation](https://fal.ai/docs/documentation)
- [Python Client](https://fal.ai/docs/api-reference/client-libraries/python)
- [JavaScript Client](https://fal.ai/docs/api-reference/client-libraries/javascript)

### Other agent-readable surfaces

This file covers one model. To find anything else:

- [Platform overview](https://fal.ai/llms.txt): Entry points and representative endpoint IDs
- [Documentation index](https://fal.ai/docs/llms.txt): Every documentation page
- [Full documentation text](https://fal.ai/docs/llms-full.txt): The whole documentation inlined
- Any other model: `https://fal.ai/models/<endpoint-id>/llms.txt`
