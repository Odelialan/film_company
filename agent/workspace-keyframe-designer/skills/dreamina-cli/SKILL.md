---
name: dreamina-cli
description: Use when the keyframe designer needs Dreamina（即梦） image or video generation through the local `dreamina` CLI.
---

# Dreamina CLI

Use this skill when the keyframe designer needs real Dreamina（即梦） image or video generation through `dreamina`.

## Entry Point

- CLI binary: `/home/honeycake/.local/bin/dreamina`
- Help first: `dreamina -h`
- Command help: `dreamina <subcommand> -h`
- Login check: `dreamina user_credit`

## Login

If `dreamina user_credit` reports no valid login state, use:

```bash
dreamina login
```

The current CLI uses OAuth Device Flow. The command prints `verification_uri`, `user_code`, and `device_code`, then waits for authorization. The user must complete OAuth authorization in a browser. After authorization, verify with:

```bash
dreamina user_credit
```

If you only need to print the authorization material without polling, use:

```bash
dreamina login --headless
dreamina login checklogin --device_code=<device_code> --poll=30
```

## Keyframe Image Generation

For text-to-keyframe generation:

```bash
dreamina text2image --prompt="<prompt>" --ratio=16:9 --resolution_type=2k --model_version=5.0
```

For image reference edits:

```bash
dreamina image2image --images=<image_path> --prompt="<prompt>" --ratio=16:9 --resolution_type=2k --model_version=5.0
```

Generated keyframe images belong under the active project:

```text
07_keyframes/KEYFRAMES/
```

## Video Generation

For one keyframe to video:

```bash
dreamina image2video --image=<image_path> --prompt="<motion_prompt>" --duration=5 --model_version=seedance2.0fast
```

For text-to-video when no keyframe image exists:

```bash
dreamina text2video --prompt="<prompt>" --duration=5 --ratio=16:9 --model_version=seedance2.0fast
```

For first-frame/last-frame video:

```bash
dreamina frames2video --first=<first_image> --last=<last_image> --prompt="<transition_prompt>"
```

For multi-keyframe storytelling:

```bash
dreamina multiframe2video --images ./a.png,./b.png,./c.png --transition-prompt="A 到 B 的运动" --transition-prompt="B 到 C 的运动"
```

For all-around reference video generation:

```bash
dreamina multimodal2video --image ./input.png --prompt="cinematic shot, keep character identity" --model_version=seedance2.0fast --duration=5
```

Generated videos belong under the active project:

```text
09_assets/processed/
```

## Async Result Rule

Generation commands are async. Treat a submit as valid only when a `submit_id` is returned. Query and download results with:

```bash
dreamina query_result --submit_id=<submit_id> --download_dir=<download_dir>
```

If the CLI returns `AigcComplianceConfirmationRequired`, the user must complete the one-time authorization in Dreamina Web and retry.
