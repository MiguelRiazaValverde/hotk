import test from 'ava';
import { hotKey, KeyCodes, Mods, Stroke, manager } from '../dist/index.js';


manager.unref();


test('Register', t => {
    hotKey([Mods.Control], KeyCodes.KeyA)
        .register();

    t.truthy(true);
});


test.skip('_', t => {
    hotKey([Mods.Control], KeyCodes.KeyA)
        .action(() => console.log("ctrl a"))
        .stroke(Stroke.Double)
        .subaction(
            hotKey([], KeyCodes.KeyB)
                .action(() => console.log("ctrl a > b"))
                .subaction(
                    hotKey([], KeyCodes.KeyZ)
                        .action(() => console.log("ctrl a > b > z"))
                )
        )
        .subactionsTimeout(1000)
        .register();

    hotKey([Mods.Control, Mods.Alt], KeyCodes.Space)
        .action(() => console.log("space"))
        .stroke(Stroke.Double)
        .subaction(
            hotKey([], KeyCodes.KeyB)
                .action(() => console.log("space > b"))
        )
        .register();

    hotKey([], KeyCodes.Escape)
        .action(() => {
            manager.recoverRoot();
            console.log("escape");
        })
        .stroke(Stroke.Double)
        .global(true)
        .register();

    t.truthy(true);
});