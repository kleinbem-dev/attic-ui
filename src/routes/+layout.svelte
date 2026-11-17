<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-accent-fg focus:shadow-lg"
>
	Skip to main content
</a>

<div class="min-h-screen bg-bg text-heading flex flex-col">
	{@render children()}
</div>
