const languageData = {
    Latency: "Latency",
};
  
export const translates = (key, ...args) => {
    const translation = languageData[key];
    if (typeof translation === "function") return translation(args);
    else return translation;
};