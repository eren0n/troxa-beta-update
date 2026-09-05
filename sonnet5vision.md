# OpenRouter [Vision]

> Run any Vision Language Model with fal. Analyze and understand images using Claude (Anthropic), GPT-5 / GPT-4o (OpenAI), Gemini (Google), Grok (xAI), Llama (Meta), Qwen, Pixtral (Mistral), and more. Send one or multiple images for captioning, analysis, OCR, or visual Q&A. Powered by OpenRouter. 


## Overview

- **Endpoint**: `https://fal.run/openrouter/router/vision`
- **Model ID**: `openrouter/router/vision`
- **Category**: vision
- **Kind**: inference


## Pricing

You will be charged based on the number of input and output tokens.

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`image_urls`** (`list<string>`, _optional_):
  List of image URLs to be processed.
  - Array of string
  - Examples: ["https://fal.media/files/tiger/4Ew1xYW6oZCs6STQVC7V8_86440216d0fe42e4b826d03a2121468e.jpg"]

- **`pdf_urls`** (`list<string>`, _optional_):
  List of PDF document URLs to be processed. Only PDF files are accepted: http(s) URLs must point to a .pdf file and data URIs must be data:application/pdf;base64,... Models without native PDF support fall back to OpenRouter's document parsing.
  - Array of string
  - Examples: ["https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"]

- **`prompt`** (`string`, _required_):
  Prompt to be used for the image
  - Examples: "Caption this image for a text-to-image model with as much detail as possible."

- **`system_prompt`** (`string`, _optional_):
  System prompt to provide context or instructions to the model
  - Examples: "Only answer the question, do not provide any additional information or add any prefix/suffix other than the answer of the original question. Don't use markdown."

- **`model`** (`string`, _required_):
  Name of the model to use. Charged based on actual token usage.
  - Examples: "google/gemini-2.5-flash", "anthropic/claude-sonnet-5", "anthropic/claude-sonnet-4.6", "anthropic/claude-sonnet-4.5", "openai/gpt-4o", "moonshotai/kimi-k2.5", "qwen/qwen3-vl-235b-a22b-instruct", "x-ai/grok-4-fast"

- **`reasoning`** (`boolean`, _optional_):
  Should reasoning be the part of the final answer.
  - Default: `false`

- **`temperature`** (`float`, _optional_):
  This setting influences the variety in the model's responses. Lower values lead to more predictable and typical responses, while higher values encourage more diverse and less common responses. At 0, the model always gives the same response for a given input. Default value: `1`
  - Default: `1`
  - Range: `0` to `2`

- **`max_tokens`** (`integer`, _optional_):
  This sets the upper limit for the number of tokens the model can generate in response. It won't produce more than this limit. The maximum value is the context length minus the prompt length.

- **`enable_web_search`** (`boolean`, _optional_):
  Give the model access to real-time web information via OpenRouter's web search server tool. When enabled, the model decides when to search and may search multiple times per request. Search costs are charged in addition to token usage.
  - Default: `false`

- **`web_search_options`** (`WebSearchOptions`, _optional_):
  Options for web search (engine, result limits, domain filters, ...). Ignored unless enable_web_search is true.



**Required Parameters Example**:

```json
{
  "prompt": "Caption this image for a text-to-image model with as much detail as possible.",
  "model": "google/gemini-2.5-flash"
}
```

**Full Example**:

```json
{
  "image_urls": [
    "https://fal.media/files/tiger/4Ew1xYW6oZCs6STQVC7V8_86440216d0fe42e4b826d03a2121468e.jpg"
  ],
  "pdf_urls": [
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  ],
  "prompt": "Caption this image for a text-to-image model with as much detail as possible.",
  "system_prompt": "Only answer the question, do not provide any additional information or add any prefix/suffix other than the answer of the original question. Don't use markdown.",
  "model": "google/gemini-2.5-flash",
  "temperature": 1
}
```


### Output Schema

The API returns the following output format:

- **`output`** (`string`, _required_):
  Generated output
  - Examples: "A close-up of a tiger's face focusing on its bright orange iris and the area around its eye, with white fur eyebrows and a contrasting black and rich orange striped fur pattern. The word \"FLUX\" is overlaid in bold, white, brush-stroke styled text across the tiger's face."

- **`usage`** (`UsageInfo`, _required_):
  Token usage information
  - Examples: {"total_tokens":1403,"cost":0.0005595,"prompt_tokens":1340,"completion_tokens":63}



**Example Response**:

```json
{
  "output": "A close-up of a tiger's face focusing on its bright orange iris and the area around its eye, with white fur eyebrows and a contrasting black and rich orange striped fur pattern. The word \"FLUX\" is overlaid in bold, white, brush-stroke styled text across the tiger's face.",
  "usage": {
    "total_tokens": 1403,
    "cost": 0.0005595,
    "prompt_tokens": 1340,
    "completion_tokens": 63
  }
}
```


## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/openrouter/router/vision \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Caption this image for a text-to-image model with as much detail as possible.",
     "model": "google/gemini-2.5-flash"
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
    "openrouter/router/vision",
    arguments={
        "prompt": "Caption this image for a text-to-image model with as much detail as possible.",
        "model": "google/gemini-2.5-flash"
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

const result = await fal.subscribe("openrouter/router/vision", {
  input: {
    prompt: "Caption this image for a text-to-image model with as much detail as possible.",
    model: "google/gemini-2.5-flash"
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

- [Model Playground](https://fal.ai/models/openrouter/router/vision)
- [API Documentation](https://fal.ai/models/openrouter/router/vision/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=openrouter/router/vision)

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
