use eventsource_stream::Eventsource;
use futures_util::StreamExt;

fn main() {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .unwrap();
    let input = "\u{feff}data: value\u{feff}kept\n\n".as_bytes();
    runtime.block_on(async {
        for width in 1..=input.len() {
            let mut chunks = vec![Ok::<_, ()>(Vec::new())];
            chunks.extend(input.chunks(width).map(|chunk| Ok(chunk.to_vec())));
            let events = futures_util::stream::iter(chunks)
                .eventsource()
                .collect::<Vec<_>>()
                .await;
            assert_eq!(events.len(), 1, "width {width}");
            assert_eq!(
                events[0].as_ref().unwrap().data,
                "value\u{feff}kept",
                "width {width}"
            );
        }
    });
    println!("{{\"passed\":true,\"chunkWidths\":{},\"leadingEmptyChunk\":true,\"interiorBomPreserved\":true}}", input.len());
}
