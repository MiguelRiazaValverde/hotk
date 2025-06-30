
import { Event, EventType, hotk as managerFactory, HotkManager, KeyCode, Mod, getHotkeyId, keyCodeKeys, modKeys } from "@hotk/core";


export * as core from "@hotk/core";
export { KeyCode, Mod } from "@hotk/core";

/**
 * Enum representing the type of key stroke.
 * - Single: a single key press
 * - Double: a double key press
 */
export enum Stroke {
    Single,
    Double,
}

/**
 * Mapping of all KeyCode enum values to themselves.
 * This is used to provide a record where keys and values are KeyCodes,
 * allowing easy lookup and iteration over all KeyCodes.
 */
const keyCodesMap: Partial<Record<KeyCode, KeyCode>> = {};

// Populate keyCodesMap with all key codes from keyCodeKeys()
for (const key of keyCodeKeys()) {
    keyCodesMap[key as KeyCode] = key as KeyCode;
}

/** 
 * Exported constant that contains a complete mapping
 * of KeyCode keys to their corresponding KeyCode values.
 */
export const KeyCodes = keyCodesMap as Record<KeyCode, KeyCode>;

/**
 * Mapping of all Mod enum values to themselves.
 * Similar to KeyCodes, this allows easy lookup and iteration over all modifier keys.
 */
const ModsMap: Partial<Record<Mod, Mod>> = {};

// Populate ModsMap with all modifier keys from modKeys()
for (const key of modKeys()) {
    ModsMap[key as Mod] = key as Mod;
}

/**
 * Exported constant that contains a complete mapping
 * of Mod keys to their corresponding Mod values.
 */
export const Mods = ModsMap as Record<Mod, Mod>;



const innerManager: HotkManager = managerFactory()!;
let globals: { [key: number]: HotKey } = {};
let locals: { [key: number]: HotKey } = {};
let root: HotKey[] | undefined = undefined;
let timeoutRecoverRoot: NodeJS.Timeout | undefined = undefined;


innerManager.init(evt => manager.handleEvent(evt));



function clearLocals() {
    for (const hotKey of Object.values(locals))
        manager.unregister(hotKey);
}


function withSnapshot(hotKeys: HotKey[], timeout: number) {
    if (timeoutRecoverRoot !== undefined)
        clearInterval(timeoutRecoverRoot);

    if (!root)
        root = Object.values(locals);

    clearLocals();

    for (const hotKey of hotKeys)
        manager.register(hotKey, false);

    if (!isNaN(timeout))
        timeoutRecoverRoot = setTimeout(() => manager.recoverRoot(), Math.min(timeout, 2147483647));
}

/**
 * Main hotkey manager object providing API for registering, unregistering,
 * and handling global/local hotkeys with lifecycle control.
 */
export const manager = {
    /**
     * Releases the Node.js event loop reference, allowing the process
     * to exit naturally if no other tasks remain.
     */
    unref() {
        innerManager.unref();
    },

    /**
     * Re-acquires the event loop reference to keep the process alive,
     * typically after a previous unref call.
     */
    refer() {
        innerManager.refer();
    },

    /**
     * Handles incoming hotkey events by firing the registered hotkey's action.
     *
     * @param event - The hotkey event to process.
     */
    handleEvent(event: Event) {
        const handler = globals[event.id] || locals[event.id];
        if (event.eventType === EventType.Pressed) {
            handler?.fire();
        }
    },

    /**
     * Registers a hotkey either globally or locally.
     *
     * @param hotKey - The HotKey instance to register.
     * @param isGlobal - Whether to register the hotkey globally.
     *
     * @throws Error if the hotkey is already registered.
     */
    register(hotKey: HotKey, isGlobal: boolean) {
        if (locals[hotKey.id] || globals[hotKey.id]) {
            throw new Error("Duplicated hotkey");
        }
        const result = innerManager.register(hotKey.mods, hotKey.code);
        if (result.isOk()) {
            (isGlobal ? globals : locals)[result.id] = hotKey;
        }
    },

    /**
     * Unregisters a hotkey from global or local scope.
     *
     * @param hotKey - The HotKey instance to unregister.
     */
    unregister(hotKey: HotKey) {
        const result = innerManager.unregister(hotKey.mods, hotKey.code);
        if (result.isOk()) {
            delete locals[result.id];
            delete globals[result.id];
        }
    },

    /**
     * Recovers the root hotkey context by clearing all local hotkeys
     * and re-registering the root hotkeys.
     */
    recoverRoot() {
        if (!root) return;

        clearInterval(timeoutRecoverRoot);
        clearLocals();

        for (const hotKey of root) {
            this.register(hotKey, false);
        }

        root = undefined;
        timeoutRecoverRoot = undefined;
    },

    /**
     * Destroys the manager, unregistering all hotkeys and cleaning up resources.
     */
    destroy() {
        innerManager.destroy();
    },
};



/**
 * Represents a keyboard shortcut with optional modifiers, stroke style,
 * subactions, and an associated callback function.
 *
 * Can be registered globally or locally, and supports advanced behaviors
 * like stroke detection (e.g., double-press), timeouts, and action trees.
 */
class HotKey {
    /**
     * Keeps a reference to the last triggered hotkey, used for stroke handling.
     */
    static lastHotKey: HotKey | null = null;

    /**
     * Timestamp of the last hotkey fire, used to detect stroke patterns.
     */
    static lastFire: number = new Date(-8640000000000000).getTime();

    /**
     * Unique ID for this hotkey, based on its key code and modifiers.
     */
    readonly id: number;

    private _description?: string;
    private _stroke: Stroke = Stroke.Single;
    private _strokeTimeout: number = 1000;
    private _action: () => void = () => { };
    private _subactions: HotKey[];
    private _subactionsTimeout: number = 1000;
    private _backToRoot: boolean = true;
    private _global: boolean = false;

    /**
     * Creates a new HotKey instance.
     * @param mods - Modifier keys like Control, Shift, etc.
     * @param code - The main key code for the hotkey.
     */
    constructor(public mods: Mod[], public code: KeyCode) {
        this.id = getHotkeyId(code, mods);
        this._subactions = [];
    }

    /**
     * Sets a human-readable description for the hotkey.
     */
    description(description: string): this {
        this._description = description;
        return this;
    }

    /**
     * Sets the stroke type (e.g., single press, double press).
     */
    stroke(stroke: Stroke): this {
        this._stroke = stroke;
        return this;
    }

    /**
     * Defines the timeout (ms) to detect repeated strokes.
     */
    strokeTimeout(timeout: number): this {
        this._strokeTimeout = timeout;
        return this;
    }

    /**
     * Assigns the callback to run when the hotkey is triggered.
     */
    action(action: () => void): this {
        this._action = action;
        return this;
    }

    /**
     * Adds a single subaction (chained hotkey).
     * Throws if the hotkey is marked as global.
     */
    subaction(subaction: HotKey): this {
        if (this._global)
            throw new Error("Subactions are not supported for global hotkeys");
        this._subactions.push(subaction);
        return this;
    }

    /**
     * Replaces subactions with a new list.
     * Throws if the hotkey is marked as global.
     */
    subactions(subactions: HotKey[]): this {
        if (this._global)
            throw new Error("Subactions are not supported for global hotkeys");
        this._subactions = subactions;
        return this;
    }

    /**
     * Sets how long (ms) subactions are available after the main hotkey is fired.
     */
    subactionsTimeout(timeout: number): this {
        this._subactionsTimeout = timeout;
        return this;
    }

    /**
     * Whether to return to the root hotkey context after subaction handling.
     */
    backToRoot(value: boolean): this {
        this._backToRoot = value;
        return this;
    }

    /**
     * Marks this hotkey as global.
     * Automatically removes all subactions (not supported in global mode).
     */
    global(value: boolean): this {
        this._global = value;
        this._subactions = [];
        return this;
    }

    /**
     * Triggers the hotkey action, considering stroke detection and subactions.
     */
    fire() {
        const fire =
            this._stroke === Stroke.Single ||
            (HotKey.lastHotKey === this &&
                Date.now() - HotKey.lastFire <= this._strokeTimeout);

        if (fire) {
            HotKey.lastFire = new Date(-8640000000000000).getTime();
            this._action();
            this.fireSubactions();
        } else {
            HotKey.lastFire = Date.now();
        }

        HotKey.lastHotKey = this;
    }

    /**
     * Triggers the subactions if available, otherwise returns to the root.
     */
    private fireSubactions() {
        if (!this._subactions.length)
            manager.recoverRoot();
        else
            withSnapshot(this._subactions, this._subactionsTimeout);
    }

    /**
     * Registers the hotkey with the system.
     */
    register(): this {
        manager.register(this, this._global);
        return this;
    }

    /**
     * Unregisters the hotkey from the system.
     */
    unregister(): this {
        manager.unregister(this);
        return this;
    }
}

/**
 * Creates a new HotKey instance with the given modifiers and key code.
 *
 * @param mods - Array of modifier keys (e.g., Control, Alt)
 * @param keyCode - The main key code for the hotkey
 * @returns A new HotKey object configured with the specified modifiers and key
 * 
 * @example
 * ```js
 * import { hotKey, KeyCodes, Mods } from '@hotk/hotk';
 * 
 * hotKey([Mods.Control], KeyCodes.KeyA)
 *  .register();
 * ```
 */
export function hotKey(mods: Mod[], keyCode: KeyCode): HotKey {
    return new HotKey(mods, keyCode);
}
