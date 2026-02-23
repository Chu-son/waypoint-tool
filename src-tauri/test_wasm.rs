use wasmtime::{Config, Engine, Linker, Module, Store};
use wasmtime_wasi::{WasiCtxBuilder, WasiP1Ctx, WasiView};

fn test() {
    let mut config = Config::new();
    let engine = Engine::new(&config).unwrap();
    let mut linker = Linker::<WasiP1Ctx>::new(&engine);
    
    wasmtime_wasi::preview1::add_to_linker_sync(&mut linker, |t| t).unwrap();

    let mut builder = WasiCtxBuilder::new();
    let ctx = builder.build_p1();
    
    let mut store = Store::new(&engine, ctx);
}

fn main() {}
