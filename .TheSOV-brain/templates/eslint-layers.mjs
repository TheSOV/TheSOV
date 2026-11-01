// BRAIN
// ----------------------------------------------------
//   decisions/the-harness-holds-the-standard-the-repo-holds-the-policy.md
// ----------------------------------------------------
// /BRAIN

/**
 * This repo's architecture, as eslint can check it.
 *
 * `harness rules` runs this file and nothing else, so what is in here is
 * architecture rather than lint. That distinction is the point: an
 * `eslint-disable` on a style rule is a shrug, and an `eslint-disable` on this
 * file is somebody switching off a decision.
 *
 * **The harness does not decide any of this.** What it holds is that a layered
 * architecture has two properties - imports run downward, and one place talks
 * to the network. Which folders are layers, in what order, and where the client
 * lives are yours, and they are stated below.
 *
 * Two core eslint rules cover both, so this needs no plugin:
 *   no-restricted-imports  - the layer order
 *   no-restricted-globals  - the single client
 *
 * Copied here to be edited. Delete what does not apply; the rule only runs
 * because this file exists.
 */

// ---------------------------------------------------------------------------
// 1. Your layers, top to bottom. Everything may import from below it.
//
// Derive this from what the code already does rather than from what it should:
// a rule that ratifies reality is adopted, and one that fights it gets the
// whole gate switched off. Group names that may import each other as siblings.
// ---------------------------------------------------------------------------

const LAYERS = [
	["pages", "layouts"],
	["components"],
	["composables"],
	["stores", "services"], // siblings: either may import the other
	["utils", "constants", "types"],
];

/** Where the source lives, if not `src`. */
const SRC = "src";

/**
 * The layers allowed to talk to the network. Everywhere else goes through them.
 *
 * Usually one - a boot file exporting a configured client. Widen it to what is
 * true today rather than to what should be true: pointed at a single folder in
 * a codebase that also calls `fetch` from its API layer, this fired 119 times,
 * and a rule that fires on everything is one somebody switches off. Narrow it
 * later, once the calls have moved.
 */
const CLIENT = ["boot"];

// ---------------------------------------------------------------------------
// 3. Parsing. REQUIRED if this repo has anything but plain `.js`.
//
// `--no-config-lookup` drops eslint's defaults - the ignores AND the parsers -
// so a config that says nothing here reads `.js` and silently skips everything
// else. Pointed at a 700-file Vue app with this empty, it reported 594 parsing
// errors, ten real findings, and looked like it had checked the codebase.
//
// Import whatever this repo's own eslint.config already uses. It is already
// installed, so this adds no dependency. For a Quasar/Vue app that is usually:
//
//   import pluginVue from "eslint-plugin-vue"
//   import vueTs from "@vue/eslint-config-typescript"
//   const PARSING = [...pluginVue.configs["flat/base"], ...vueTs()]
//
// Leave it empty only in a repo that really is plain JavaScript.
// ---------------------------------------------------------------------------

const PARSING = [];

// ---------------------------------------------------------------------------
// Below here is mechanism. It should not need editing.
// ---------------------------------------------------------------------------

/**
 * The language settings of a config, without the rules it also carries.
 *
 * A parser preset ships a recommended rule set with it. Spread whole, this file
 * stops being architecture and becomes lint again - `vue/block-lang` alone
 * fired 255 times, drowning the twelve findings that were the point. Keep the
 * parsing, drop the opinions.
 */
const parsingOnly = (configs) =>
	configs
		.filter((config) => config.languageOptions || config.plugins)
		.map((config) => ({
			...(config.files ? { files: config.files } : {}),
			...(config.ignores ? { ignores: config.ignores } : {}),
			...(config.languageOptions
				? { languageOptions: config.languageOptions }
				: {}),
			...(config.plugins ? { plugins: config.plugins } : {}),
		}));

const globs = (name) => [
	`${SRC}/${name}/*`,
	`${SRC}/${name}/**`,
	`**/${name}/*`,
	`**/${name}/**`,
];

/** Every layer strictly above `index`, which is what a layer may not import. */
const above = (index) => LAYERS.slice(0, index).flat().flatMap(globs);

/** Importing the raw HTTP client instead of the configured one. */
const CLIENT_PATHS = [
	{
		name: "axios",
		message: `import the configured client from ${CLIENT.join(" or ")} rather than axios itself`,
	},
];

/**
 * One `no-restricted-imports` per file set, never two.
 *
 * A later flat-config block replaces the rule of an earlier one for the files
 * both match. Declaring the layer patterns in one block and the client paths in
 * another - both matching `src` - silently switched the layer check off while
 * still reporting the client one, which reads exactly like a passing gate.
 */
const CLIENT_GLOBS = CLIENT.map((name) => `${SRC}/${name}/**`);

/** The layer-order half, re-stated for a client layer the axios rule skips. */
const clientBlock = (files, patterns) => {
	const mine = files.filter((glob) => CLIENT_GLOBS.includes(glob));
	if (!patterns.length || !mine.length) return [];
	return [
		{
			files: mine,
			rules: { "no-restricted-imports": ["error", { patterns }] },
		},
	];
};

const restrict = (files, patterns, ignores) => [
	{
		files,
		// The client layer is the one place that may import the raw library -
		// it is what everything else goes through. Without this the rule fires
		// on the very file it exists to protect, which reads as the check being
		// wrong rather than the code.
		ignores: [...CLIENT_GLOBS, ...(ignores ?? [])],
		rules: {
			"no-restricted-imports": [
				"error",
				{ paths: CLIENT_PATHS, ...(patterns.length ? { patterns } : {}) },
			],
		},
	},
	// The client layer still owes the layer order, just not the axios rule.
	...clientBlock(files, patterns),
];

const layerRules = LAYERS.flatMap((names, index) =>
	restrict(
		names.map((name) => `${SRC}/${name}/**`),
		above(index).length
			? [
					{
						group: above(index),
						message: `${names.join("/")} sits below that layer - imports run downward only`,
					},
				]
			: [],
	),
);

export default [
	// eslint 9 reports `eslint-disable` comments for rules this config does not
	// enable - and it enables almost none, so every disable in the repo shows up
	// as a warning here. That is lint noise inside the file that exists to say
	// what is architecture.
	{ linterOptions: { reportUnusedDisableDirectives: "off" } },

	...parsingOnly(PARSING),

	// Stated because `--no-config-lookup` drops eslint's defaults. Without this
	// the rules run over node_modules and report hundreds of problems in code
	// nobody here wrote.
	{
		ignores: [
			"**/node_modules/**",
			"dist/**",
			".quasar/**",
			"**/*.d.ts",
			"DOCS/**",
		],
	},

	// Files that belong to no layer still may not reach for axios.
	...restrict(
		[`${SRC}/**/*.{js,mjs,ts,vue}`],
		[],
		LAYERS.flat().map((name) => `${SRC}/${name}/**`),
	),

	...layerRules,

	// `fetch` and `XMLHttpRequest` are globals rather than imports, so they need
	// the other rule - a layer check alone would never see them.
	{
		files: [`${SRC}/**/*.{js,mjs,ts,vue}`],
		ignores: CLIENT_GLOBS,
		rules: {
			"no-restricted-globals": [
				"error",
				{
					name: "fetch",
					message: `talk to the network through ${CLIENT.join(" or ")}, so timeouts, auth and errors are decided once`,
				},
				{
					name: "XMLHttpRequest",
					message: `talk to the network through ${CLIENT.join(" or ")}`,
				},
			],
		},
	},
];
