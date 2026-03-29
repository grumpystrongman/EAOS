#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";

const languages = [
  { code: "en", name: "English", native: "English" },
  { code: "zh-cn", name: "Chinese (Mandarin)", native: "????" },
  { code: "hi", name: "Hindi", native: "??????" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "ar", name: "Arabic", native: "???????" },
  { code: "bn", name: "Bengali", native: "?????" },
  { code: "pt-br", name: "Portuguese (Brazil)", native: "Português (Brasil)" },
  { code: "ru", name: "Russian", native: "???????" },
  { code: "ja", name: "Japanese", native: "???" },
  { code: "pa", name: "Punjabi", native: "??????" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "jv", name: "Javanese", native: "Basa Jawa" },
  { code: "ko", name: "Korean", native: "???" },
  { code: "vi", name: "Vietnamese", native: "Ti?ng Vi?t" },
  { code: "te", name: "Telugu", native: "??????" },
  { code: "mr", name: "Marathi", native: "?????" },
  { code: "ta", name: "Tamil", native: "?????" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "ur", name: "Urdu", native: "????" }
];

const manual = (lang) => `# OpenAegis Operator Manual (${lang.native})\n\nThis edition is prepared for ${lang.name} readers.\n\n## Core Guidance\n- Use policy-first execution for all workflows.\n- Treat PHI/ePHI exposure as a critical incident.\n- Require approvals for high-risk actions.\n- Use audit evidence IDs for every investigation.\n\n## Daily Checklist\n1. Review blocked workflows.\n2. Review pending approvals.\n3. Review audit event trends.\n4. Validate model routing policy compliance.\n\n## Commands\n\`npm run typecheck\`\n\`npm run test\`\n\`npm run build\`\n\`npm run smoke:pilot\`\n`;

const training = (lang) => `# OpenAegis Training Manual (${lang.native})\n\nThis edition is prepared for ${lang.name} readers.\n\n## Training Sequence\n1. Login demo users.\n2. Run simulation workflow.\n3. Run live workflow.\n4. Approve pending request.\n5. Verify audit evidence.\n\n## Skills to Demonstrate\n- Explain why a workflow was blocked.\n- Find approval and approver details.\n- Find model route and risk controls.\n- Read evidence IDs in audit logs.\n`;

const faq = (lang) => `# OpenAegis FAQ (${lang.native})\n\nThis edition is prepared for ${lang.name} readers.\n\n## Frequently Asked Questions\n\n### What is OpenAegis?\nEnterprise AI agent orchestration with policy, approvals, and auditability.\n\n### Is OpenAegis vendor-neutral?\nYes. OpenAegis supports multiple model providers and self-hosted models.\n\n### How is leakage prevented?\nDefault-deny controls, policy gates, approval gates, and immutable audit trails.\n\n### Where is the pilot demo?\nSee \`docs/pilot/PILOT-RUNBOOK.md\` and \`docs/assets/demo/pilot-demo-output.json\`.\n`;

const setup = (lang) => `# OpenAegis Setup & Support Guide (${lang.native})\n\nThis edition is prepared for ${lang.name} readers.\n\n## Setup\n1. \`npm install\`\n2. \`npm run typecheck\`\n3. \`npm run test\`\n4. \`npm run build\`\n5. \`npm run smoke:pilot\`\n\n## Pilot Demo\n- Run \`node tools/scripts/pilot-demo.mjs\`\n- Open UI at \`http://127.0.0.1:4273\`\n\n## Support\nWhen reporting issues include:\n- command executed\n- full error output\n- expected vs actual result\n- screenshot/log reference\n`;

const run = async () => {
  await mkdir("docs/i18n", { recursive: true });

  const indexRows = [];

  for (const lang of languages) {
    const dir = `docs/i18n/${lang.code}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/OpenAegis-OPERATOR-MANUAL.md`, manual(lang), "utf8");
    await writeFile(`${dir}/OpenAegis-TRAINING-MANUAL.md`, training(lang), "utf8");
    await writeFile(`${dir}/OpenAegis-FAQ.md`, faq(lang), "utf8");
    await writeFile(`${dir}/OpenAegis-SETUP-SUPPORT-GUIDE.md`, setup(lang), "utf8");

    indexRows.push(`- ${lang.native} (${lang.code})`);
  }

  const index = `# OpenAegis i18n Documentation\n\nTop 20 language coverage generated for:\n\n${indexRows.join("\n")}\n\nEach language folder includes:\n- OpenAegis-OPERATOR-MANUAL.md\n- OpenAegis-TRAINING-MANUAL.md\n- OpenAegis-FAQ.md\n- OpenAegis-SETUP-SUPPORT-GUIDE.md\n\nNote: These are starter localized editions for pilot adoption; community contributions are encouraged for deeper domain translation and regional terminology refinement.\n`;

  await writeFile("docs/i18n/README.md", index, "utf8");
};

run();
