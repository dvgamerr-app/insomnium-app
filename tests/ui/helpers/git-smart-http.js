/** Saved native smart-HTTP fixture with real packs and an optional advertisement gate.
 * @param {{advertisement:string,pack:Buffer}} pack */
export function serveGitPack(pack) {
  const state = { gets: 0, posts: 0, holdNextAdvertisement: false, gated: false,
    releaseAdvertisement: /** @type {(()=>void)|undefined} */ (undefined) };
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    if (request.method === "POST") {
      state.posts++;
      await request.arrayBuffer();
      return new Response(Buffer.concat([Buffer.from("0008NAK\n"), pack.pack]), {
        headers: { "Content-Type": "application/x-git-upload-pack-result" },
      });
    }
    state.gets++;
    if (state.holdNextAdvertisement) {
      state.holdNextAdvertisement = false;
      state.gated = true;
      await new Promise(resolve => { state.releaseAdvertisement = () => resolve(undefined); });
    }
    return new Response(pack.advertisement, {
      headers: { "Content-Type": "application/x-git-upload-pack-advertisement" },
    });
  } });
  return { server, state, close() { state.releaseAdvertisement?.(); server.stop(true); } };
}
