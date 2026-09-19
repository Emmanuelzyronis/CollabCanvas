.PHONY: check workflow

check:
	npm test -- --run
	npm run typecheck
	npm run build

# Browser proof of the human design workflow. Requires `npm run dev` and `npm run api`.
workflow:
	npm run workflow:human
