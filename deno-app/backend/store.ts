/**
 * JSON ファイル永続化ストア（Tauri 版 `tauri-plugin-store` 相当）。
 *
 * 移行元: フロントが `@tauri-apps/plugin-store` の
 * `load(name, { defaults, autoSave })` で開き、`get<T>(key)` / `set(key, value)`
 * でウィンドウサイズ・カラム幅・お気に入り・表示モード・読み方向を読み書きしていた
 * （`src/api/store.ts` / `favorites.ts` / `settings.ts`）。
 *
 * `backend/` は Deno Desktop API に依存しない純粋ロジックとして実装する。永続化先の
 * パスは呼び出し側（アプリ層）が与える。これにより単体テストでは一時ファイルを使える。
 */

/** ストアに保持する値の集合（キー→任意の JSON 値）。 */
export type StoreState = Record<string, unknown>;

/** `Store.load` のオプション。Tauri 版 `load` の第2引数に対応。 */
export interface StoreOptions {
  /** ファイルが存在しないときに初期投入する既定値。 */
  defaults?: StoreState;
  /** `set`/`delete` のたびに自動でファイルへ書き出すか（既定: false）。 */
  autoSave?: boolean;
}

async function ensureParentDir(path: string): Promise<void> {
  const sep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (sep <= 0) return;
  const dir = path.slice(0, sep);
  await Deno.mkdir(dir, { recursive: true });
}

/**
 * JSON ファイルに紐づくキー・バリューストア。`Store.load` で生成する。
 * 読み取り系（`get`/`has`/`keys`/`entries`）はメモリ上の状態を同期で返し、
 * 書き込み系（`set`/`delete`/`save`）はファイル IO を伴うため非同期。
 */
export class Store {
  readonly path: string;
  #state: StoreState;
  #autoSave: boolean;

  private constructor(path: string, state: StoreState, autoSave: boolean) {
    this.path = path;
    this.#state = state;
    this.#autoSave = autoSave;
  }

  /**
   * ファイルからストアを読み込む。ファイルが無い場合は `defaults` を初期状態とする
   * （Tauri 版同様、この時点ではファイルへは書き出さない）。
   */
  static async load(path: string, options: StoreOptions = {}): Promise<Store> {
    const defaults = options.defaults ?? {};
    let state: StoreState;
    try {
      const text = await Deno.readTextFile(path);
      const parsed = JSON.parse(text);
      if (
        parsed === null || typeof parsed !== "object" || Array.isArray(parsed)
      ) {
        throw new Error(`Store file is not a JSON object: ${path}`);
      }
      state = parsed as StoreState;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        state = structuredClone(defaults);
      } else {
        throw err;
      }
    }
    return new Store(path, state, options.autoSave ?? false);
  }

  /** キーに対応する値を返す。未設定なら `undefined`。 */
  get<T>(key: string): T | undefined {
    return this.#state[key] as T | undefined;
  }

  /** キーが存在するか。 */
  has(key: string): boolean {
    return Object.hasOwn(this.#state, key);
  }

  /** 保持している全キー。 */
  keys(): string[] {
    return Object.keys(this.#state);
  }

  /** 保持している全エントリ。 */
  entries(): [string, unknown][] {
    return Object.entries(this.#state);
  }

  /** 値を設定する。`autoSave` 有効時はファイルへ書き出す。 */
  async set(key: string, value: unknown): Promise<void> {
    this.#state[key] = value;
    if (this.#autoSave) await this.save();
  }

  /** キーを削除する。削除できたら true。`autoSave` 有効時はファイルへ書き出す。 */
  async delete(key: string): Promise<boolean> {
    if (!Object.hasOwn(this.#state, key)) return false;
    delete this.#state[key];
    if (this.#autoSave) await this.save();
    return true;
  }

  /** 全エントリを消去する。`autoSave` 有効時はファイルへ書き出す。 */
  async clear(): Promise<void> {
    this.#state = {};
    if (this.#autoSave) await this.save();
  }

  /** 現在の状態を JSON ファイルへ書き出す（親ディレクトリは必要なら作成）。 */
  async save(): Promise<void> {
    await ensureParentDir(this.path);
    await Deno.writeTextFile(this.path, JSON.stringify(this.#state, null, 2));
  }
}
