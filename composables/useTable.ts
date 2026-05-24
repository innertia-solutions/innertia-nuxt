// composables/useTable.ts

type TableConfig = { name: string; endpoint: string } | string

export function useTable(tableOrName?: TableConfig) {
    const resolvedName = typeof tableOrName === 'object' ? tableOrName?.name : tableOrName

    const invalidateCache = (tableName: string) => {
        if (!tableName) {
            console.warn('[useTable] No table name provided');
            return;
        }

        try {
            const prefix = `full_table_${tableName}`
            for (const key of Object.keys(sessionStorage)) {
                if (key === prefix || key.startsWith(prefix + '_')) {
                    sessionStorage.removeItem(key)
                }
            }
            sessionStorage.removeItem(`table_cache_${tableName}`)
        } catch (error) {
            console.warn('[useTable] Error invalidating cache:', error);
        }
    };

    const invalidateMultiple = (tableNames: string[]) => {
        tableNames.forEach(name => invalidateCache(name));
    };

    const clearAllCache = () => {
        try {
            const keys = Object.keys(sessionStorage);
            const tableCacheKeys = keys.filter(key => key.startsWith('table_cache_'));
            tableCacheKeys.forEach(key => sessionStorage.removeItem(key));
        } catch (error) {
            console.warn('[useTable] Error clearing all cache:', error);
        }
    };

    const useSearch = (tableName: string) => {
        if (!tableName) {
            throw new Error('[useTable] Table name is required for useSearch');
        }

        const searchCache = useState<Record<string, string>>("table-search-cache", () => ({}));
        const search = ref(searchCache.value[tableName] || "");

        watch(search, (newSearch, oldSearch) => {
            searchCache.value[tableName] = newSearch;

            if (oldSearch !== undefined && newSearch !== oldSearch) {
                invalidateCache(tableName);
            }
        }, { immediate: true });

        const clearSearch = () => { search.value = ""; };

        return { search, clearSearch };
    };

    const clearAllSearches = () => {
        const searchCache = useState<Record<string, string>>("table-search-cache", () => ({}));
        searchCache.value = {};
    };

    const getSearchCache = () => {
        const searchCache = useState<Record<string, string>>("table-search-cache", () => ({}));
        return searchCache.value;
    };

    const useFilters = <T extends Record<string, any>>(tableName: string, initialFilters: T) => {
        if (!tableName) {
            throw new Error('[useTable] Table name is required for useFilters');
        }

        const filters = useState<T>(`table_filters_${tableName}`, () => ({ ...initialFilters }));
        const resetFilters = () => { filters.value = { ...initialFilters }; };

        return { filters, resetFilters };
    };

    const invalidate = () => {
        if (resolvedName) invalidateCache(resolvedName)
        else console.warn('[useTable] No table name to invalidate')
    }

    return {
        invalidate,
        invalidateCache,
        invalidateMultiple,
        clearAllCache,
        useSearch,
        useFilters,
        clearAllSearches,
        getSearchCache
    };
}
