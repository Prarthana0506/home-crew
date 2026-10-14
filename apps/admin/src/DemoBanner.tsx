export function DemoBanner() {
    if (import.meta.env.VITE_DEMO_MODE !== 'true') return null;

    return (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center text-sm py-1 z-50 font-medium">
            Demo mode: no login required. Do not use with real data.
        </div>
    );
}