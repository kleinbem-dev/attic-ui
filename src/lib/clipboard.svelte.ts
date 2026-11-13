/**
 * Reactive clipboard helper with auto-clearing success and failure indicators.
 */
export class ClipboardFeedback {
	copiedId = $state<string | null>(null);
	failedId = $state<string | null>(null);
	#timer: ReturnType<typeof setTimeout> | null = null;

	async copy(text: string, id = 'default'): Promise<boolean> {
		if (this.#timer) clearTimeout(this.#timer);
		try {
			await navigator.clipboard.writeText(text);
			this.copiedId = id;
			this.failedId = null;
			this.#timer = setTimeout(() => {
				this.copiedId = null;
			}, 2000);
			return true;
		} catch {
			this.copiedId = null;
			this.failedId = id;
			this.#timer = setTimeout(() => {
				this.failedId = null;
			}, 3000);
			return false;
		}
	}

	destroy(): void {
		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}
}
