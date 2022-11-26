const languageData = {
    Latency: "延遲",
};
  
export const translate = (key, ...args) => {
    const translation = languageData[key];
    if (typeof translation === "function") return translation(args);
    else return translation;
};