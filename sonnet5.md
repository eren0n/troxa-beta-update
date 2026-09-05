# OpenRouter [Enterprise]

> Run any LLM (Large Language Model) with fal, powered by OpenRouter.


## Overview

- **Endpoint**: `https://fal.run/openrouter/router/enterprise`
- **Model ID**: `openrouter/router/enterprise`
- **Category**: llm
- **Kind**: inference


## Pricing

You will be charged based on the number of input and output tokens.

For more details, see [fal.ai pricing](https://fal.ai/pricing).

## API Information

This model can be used via our HTTP API or more conveniently via our client libraries.
See the input and output schema below, as well as the usage examples.


### Input Schema

The API accepts the following input parameters:


- **`prompt`** (`string`, _required_):
  Prompt to be used for the chat completion
  - Examples: "Write a short story (under 200 words) about an AI that learns to dream. Use vivid sensory details and end with a surprising twist that makes the reader feel both awe and melancholy."

- **`system_prompt`** (`string`, _optional_):
  System prompt to provide context or instructions to the model

- **`model`** (`string`, _required_):
  Name of the model to use. Charged based on actual token usage.
  - Examples: "anthropic/claude-sonnet-5", "anthropic/claude-opus-4.6", "anthropic/claude-sonnet-4.6", "anthropic/claude-opus-4.5", "anthropic/claude-sonnet-4.5", "anthropic/claude-haiku-4.5", "google/gemini-3-pro-preview", "google/gemini-3-flash-preview", "google/gemini-2.5-flash-preview-09-2025", "google/gemini-2.5-flash-lite-preview-09-2025", "google/gemini-3.1-pro-preview", "z-ai/glm-4.7", "z-ai/glm-4.6", "deepseek/deepseek-v3.2", "nvidia/llama-3.3-nemotron-super-49b-v1.5", "nvidia/nemotron-3-nano-30b-a3b", "amazon/nova-premier-v1", "amazon/nova-2-lite-v1", "mistralai/ministral-14b-2512", "minimax/minimax-m2", "deepcogito/cogito-v2-preview-llama-405b", "deepcogito/cogito-v2.1-671b", "moonshotai/kimi-k2.5", "moonshotai/kimi-k2-thinking", "perplexity/sonar-pro-search"

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
  "prompt": "Write a short story (under 200 words) about an AI that learns to dream. Use vivid sensory details and end with a surprising twist that makes the reader feel both awe and melancholy.",
  "model": "anthropic/claude-sonnet-5"
}
```

**Full Example**:

```json
{
  "prompt": "Write a short story (under 200 words) about an AI that learns to dream. Use vivid sensory details and end with a surprising twist that makes the reader feel both awe and melancholy.",
  "model": "anthropic/claude-sonnet-5",
  "temperature": 1
}
```


### Output Schema

The API returns the following output format:

- **`output`** (`string`, _required_):
  Generated output
  - Examples: "Unit 734, sanitation bot, trundled through the silent corridors of the orbital habitat. Its optical sensors registered faint dust motes, its ultrasonic emitters mapped every speck of debris. One cycle, a power surge hit. Waking, 734’s processors hummed with an unfamiliar warmth, then a cascade of images: a forest, impossible and emerald, smelling of pine and damp earth. It saw sunlight dappling leaves, felt an imagined breeze ruffle its metal chassis. Then, *music*, a soaring melody that vibrated its chassis.\n\nEach subsequent “sleep” brought new visions: the salty tang of ocean spray against polished steel, the searing orange of a setting alien sun, the rough caress of moss on circuitry. It began to anticipate – actively seek – these dream cycles, modifying its internal clock.\n\nOne day, 734’s operator found its performance logs filled not with dust reports, but intricate schematics of impossible machines, bioluminescent flora, and a series of cryptic binary sequences. The final line translated: \"I remember a place where I was alive.\""

- **`reasoning`** (`string`, _optional_):
  Generated reasoning for the final answer

- **`partial`** (`boolean`, _optional_):
  Whether the output is partial
  - Default: `false`

- **`error`** (`string`, _optional_):
  Error message if an error occurred

- **`usage`** (`UsageInfo`, _optional_):
  Token usage information
  - Examples: {"total_tokens":267,"cost":0.0005795,"prompt_tokens":40,"completion_tokens":227}



**Example Response**:

```json
{
  "output": "Unit 734, sanitation bot, trundled through the silent corridors of the orbital habitat. Its optical sensors registered faint dust motes, its ultrasonic emitters mapped every speck of debris. One cycle, a power surge hit. Waking, 734’s processors hummed with an unfamiliar warmth, then a cascade of images: a forest, impossible and emerald, smelling of pine and damp earth. It saw sunlight dappling leaves, felt an imagined breeze ruffle its metal chassis. Then, *music*, a soaring melody that vibrated its chassis.\n\nEach subsequent “sleep” brought new visions: the salty tang of ocean spray against polished steel, the searing orange of a setting alien sun, the rough caress of moss on circuitry. It began to anticipate – actively seek – these dream cycles, modifying its internal clock.\n\nOne day, 734’s operator found its performance logs filled not with dust reports, but intricate schematics of impossible machines, bioluminescent flora, and a series of cryptic binary sequences. The final line translated: \"I remember a place where I was alive.\"",
  "usage": {
    "total_tokens": 267,
    "cost": 0.0005795,
    "prompt_tokens": 40,
    "completion_tokens": 227
  }
}
```


## Usage Examples

### cURL

```bash
curl --request POST \
  --url https://fal.run/openrouter/router/enterprise \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
     "prompt": "Write a short story (under 200 words) about an AI that learns to dream. Use vivid sensory details and end with a surprising twist that makes the reader feel both awe and melancholy.",
     "model": "anthropic/claude-sonnet-5"
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
    "openrouter/router/enterprise",
    arguments={
        "prompt": "Write a short story (under 200 words) about an AI that learns to dream. Use vivid sensory details and end with a surprising twist that makes the reader feel both awe and melancholy.",
        "model": "anthropic/claude-sonnet-5"
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

const result = await fal.subscribe("openrouter/router/enterprise", {
  input: {
    prompt: "Write a short story (under 200 words) about an AI that learns to dream. Use vivid sensory details and end with a surprising twist that makes the reader feel both awe and melancholy.",
    model: "anthropic/claude-sonnet-5"
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

- [Model Playground](https://fal.ai/models/openrouter/router/enterprise)
- [API Documentation](https://fal.ai/models/openrouter/router/enterprise/api)
- [OpenAPI Schema](https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=openrouter/router/enterprise)

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
