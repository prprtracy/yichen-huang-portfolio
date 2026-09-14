const ORIGIN = "https://yichen-huang-portfolio.tracyhuang1016.chatgpt.site";

module.exports = async function handler(req, res) {
  try {
    const requestedPath = typeof req.query.path === "string" ? req.query.path : "";
    const target = new URL("/" + requestedPath.replace(/^\/+/, ""), ORIGIN);
    const upstream = await fetch(target, {
      headers: {
        "user-agent": req.headers["user-agent"] || "Yichen-Portfolio-Vercel/1.0",
        "accept": req.headers.accept || "*/*"
      }
    });

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "public, max-age=300, s-maxage=3600");

    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(body);
  } catch (error) {
    res.status(502).send("Portfolio source is temporarily unavailable.");
  }
};
