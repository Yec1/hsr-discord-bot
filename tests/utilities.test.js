import { validateCookie } from "../src/services/utilities.js";

const SAMPLE_COOKIE = "_MHYUUID=2322f04c-9a7c-4b02-8dae-e17f414c68db; G_ENABLED_IDPS=google; DEVICEFP_SEED_ID=54d474961c24b712; DEVICEFP_SEED_TIME=1672910669378; ltoken=Te9Zl50043XTb8AEufgeqnqboTYPwlFBwBPIXTkL; ltuid=335281049; account_id=335281049; account_mid_v2=1lyqqlvnog_hy; account_id_v2=335281049; hoyolab_color_scheme=system; mi18nLang=zh-tw; DEVICEFP=38d7f14a93626; HYV_LOGIN_PLATFORM_LIFECYCLE_ID={%22value%22:%225d464eb4-ad0e-4cfd-bfe7-a73e7467bf3b%22}; HYV_LOGIN_PLATFORM_OPTIONAL_AGREEMENT={%22content%22:[]}; HYV_LOGIN_PLATFORM_LOAD_TIMEOUT={}; HYV_LOGIN_PLATFORM_TRACKING_MAP={}";

const SAMPLE_RESPONSE = "ltoken=Te9Zl50043XTb8AEufgeqnqboTYPwlFBwBPIXTkL ltuid=335281049 account_id_v2=335281049 account_mid_v2=1lyqqlvnog_hy"

test("Validate the correct cookie", () => {
	expect(validateCookie(SAMPLE_COOKIE)).toBe(SAMPLE_RESPONSE);
});

test("Validate the incorrect format cookie", () => {
	expect(validateCookie("")).toBe(null);
});
