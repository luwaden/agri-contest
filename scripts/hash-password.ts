import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw || pw.length < 10) { console.error('Usage: npm run hash-password -- "a password of at least 10 characters"'); process.exit(1); }
const hash = bcrypt.hashSync(pw, 12);
console.log("bcrypt hash:\n" + hash);
// Next.js expands $VARIABLES inside .env files, which would corrupt the hash. Escape each $ when pasting into .env.local:
console.log("\nFor .env / .env.local (dollar signs escaped):\n" + hash.replace(/\$/g, "\\$"));
console.log("\nOn hosting dashboards (Vercel, etc.) paste the first form, unescaped.");
