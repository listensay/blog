---
title: "Free AI API Providers: Free Credits, Limits & Availability"
description: A personal directory of free AI APIs and community gateways, with signup credits, daily allowances, availability notes, and hands-on impressions.
date: 2026-08-19 00:00
slug: free-ai
path: /en/blog/ai/free-ai
category: 福利
tags:
  - AI
  - 白嫖
draft: false
cover: ""
translationSourceHash: c250b5bf3262540a0909e7de45d703e4b63c832ca50be5192877a0412628afa3
---

> ### Recent updates
>
> September 13, 2026: JustDoWork is temporarily unavailable.
>
> September 8, 2026: Some models on JustDoWork and SeekAI are available again.
>
> September 3, 2026: Added OrcaRouter, Conduit, and kktoken.

This is my personal collection of free AI APIs and community gateways. I have not received payment for these listings or accepted paid promotions. Some registration links contain referral codes and may grant account credits.

Ratings reflect my own experience. Providers can change their free allowances and model availability; the notes below are a record of my observations, not a guarantee of current service. Credit amounts are the balances advertised by each provider and should not be assumed to represent US dollars.

## Community AI API gateways

Community gateways forward requests to AI models. Their data handling and security are not guaranteed, so consider what information you send through them.

Before using a gateway, I recommend reading this analysis of API gateway poisoning attacks by Fausto on the Xianzhi community (in Chinese):

[AI supply chain threats: an analysis of API gateway poisoning attacks](https://xz.aliyun.com/news/92154)

<details>
<summary><h3>AgentRouter</h3></summary>

**My rating: Great.**

The operator sometimes awards additional credits based on account activity. More active users can receive larger bonuses.

- Daily check-in: 25 credits.
- Referral reward: 150 credits per invited user.
- Signup through the following link: 170 credits.

[Register with AgentRouter](https://agentrouter.org/register?aff=QieS)

</details>

<details>
<summary><h3>AnyRouter</h3></summary>

**My rating: Great.**

This is an established gateway, although reliability is mixed and responses can be slow. At the time of writing, Claude Code access is available; other options have limited capacity.

- Daily check-in: 25 credits.
- Referral reward: 50 credits per invited user.
- Signup through the following link: 50 credits.

[Register with AnyRouter](https://anyrouter.top/register?aff=78Jy)

</details>

<details>
<summary><h3>Gemai (Hajimi AI)</h3></summary>

**My rating: Average.**

Model pricing is relatively high, but the service has been stable in my experience.

- Signup with a referral: 100 credits.
- Daily check-in: a random allowance of 5–9 credits.

[Register with Gemai](https://api.gemai.cc/sign-up?aff=GmYKJSLl)

</details>

<details>
<summary><h3>SeekAI</h3></summary>

**Not yet rated: I have not tested it.**

The advertised allowances are generous:

- Signup with a referral: 200 credits.
- Daily check-in: 20 credits.
- Referral reward: 20 credits per invited user.

[Register with SeekAI](https://seekai.cc/sign-up?aff=fjxq)

</details>

### Temporarily unavailable gateways

<details>
<summary><h3>kktoken AI</h3></summary>

**Not rated.**

The listed allowances are 200 signup credits with a referral and 20 credits per daily check-in.

[kktoken AI registration](https://kktoken.cc/sign-up?aff=GGv5)

</details>

<details>
<summary><h3>TabToken</h3></summary>

**Not yet rated: I have not tested it.**

Model pricing appears relatively high.

- Signup with a referral: 100 credits.
- Daily check-in: 5–9 credits.
- Referral reward: 20 credits per invited user.

[TabToken registration](https://tabitoken.com/sign-up?aff=6boQ)

</details>

<details>
<summary><h3>GoRouter</h3></summary>

**My rating: Average.**

Speed is reasonable, but credits are consumed relatively quickly. Daily check-in grants 6–9 credits.

[GoRouter registration](https://gorouter.app/sign-up?aff=C58L)

</details>

<details>
<summary><h3>JustDoWork</h3></summary>

**Not yet rated: I have not tested it.**

Pricing appears reasonable. The listed allowances are:

- Signup with a referral: 200 credits.
- Daily check-in: 5–9 credits.
- Referral reward: 40 credits per invited user.

[JustDoWork registration](https://api.justwoker.icu/register?aff=Qk1K)

### Connection troubleshooting

![Connection troubleshooting example from the original guide](/images/Pasted-image-20260911200243.png)

The original guide suggests excluding local addresses from your proxy with the command for your operating system.

Windows:

```
setx NO_PROXY "127.0.0.1,localhost"
```

macOS:

```
 echo 'export NO_PROXY=127.0.0.1,localhost' >> ~/.zshrc && source ~/.zshrc
```

</details>

<details>
<summary><h3>Conduit — generally unavailable; access is hard to get</h3></summary>

**My rating: Great.**

Requests are fast. The original listing includes premium models such as GPT5.6 and Fable 5, plus unlimited free access to DeepSeek V4 Flash and MiniMax M3.

Open the Telegram bot below and follow its registration process. New users receive 500 credits after registering.

[Register through the Conduit Telegram bot](https://t.me/conduitoff_bot?start=ref_6406492700)

</details>

## Other AI platforms and tools

<details>
<summary><h3>NVIDIA</h3></summary>

**My rating: Excellent.**

The selection of free models is limited and changes over time. My earlier notes mention free DeepSeek V4 access; the listing later included Zhipu models.

[Explore models on NVIDIA Build](https://build.nvidia.com/models)

![NVIDIA model selection in the original article](/images/Pasted%20image%2020260819201306.png)

</details>

<details>
<summary><h3>FreeBuff</h3></summary>

**My rating: Excellent.**

My notes describe a daily window of free, unlimited DeepSeek V4 Flash usage, apparently lasting about three hours. Availability varies by region.

On August 19, 2026, access was unavailable from Hong Kong in my experience; switching to a US connection restored it. Other regions, such as India, may also have different availability.

[Get started with FreeBuff](https://freebuff.com/get-started?ref=ref-249b9117-b0e0-439d-bac9-0762fd289053&referrer=Listensay)

</details>

<details>
<summary><h3>TokenRouter</h3></summary>

**My rating: Excellent.**

In my experience, this platform offers genuinely unlimited free usage for selected models. The selection changes; my notes include Kimi v3, DeepSeek V4 Pro, Qwen3.8 Max, and GLM.

I have seen garbled output with long agent conversations. Tasks can still complete, but the final response may be difficult to read. Asking the agent to rewrite the response has sometimes helped.

[Visit TokenRouter](https://www.tokenrouter.com/)

![TokenRouter model selection](/images/Pasted%20image%2020260819195509.png)

I used this API with Hermas agent. One workaround is to ask the agent to remember to regenerate a response whenever its output becomes garbled.

![Agent configuration example](/images/a0df35509d5985a1c0b053a3ebe141b3.png)

The main drawback in my testing was readability of the output.

</details>

<details>
<summary><h3>OrcaRouter</h3></summary>

**My rating: Great.**

There are some limits and the free model selection is small, but responses were very fast in my experience.

[Visit OrcaRouter](https://www.orcarouter.ai/)

![OrcaRouter interface](/images/Pasted-image-20260904090157.png)

</details>

## Endpoints with unknown operators

I do not recommend these endpoints. They were listed as accessible without an API key, but their operators and data handling are unknown.

<details>
<summary><h3>http://20.115.208.7:4000/v1</h3></summary>

The original listing reported model access without a key.

[http://20.115.208.7:4000/v1](http://20.115.208.7:4000/v1)

![Models shown by the first endpoint](/images/Pasted%20image%2020260819201423.png)

</details>

<details>
<summary><h3>http://130.210.35.157:4000/v1</h3></summary>

This endpoint was also listed as accessible without a key.

[http://130.210.35.157:4000/v1](http://130.210.35.157:4000/v1)

![Models shown by the second endpoint](/images/Pasted%20image%2020260819201507.png)

</details>
