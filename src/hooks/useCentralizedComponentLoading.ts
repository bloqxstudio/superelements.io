
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWordPressStore } from '@/store/wordpressStore';
import { useConnectionsStore } from '@/store/connectionsStore';
import { useMultiConnectionData } from '@/hooks/useMultiConnectionData';
import { useWordPressConnection } from '@/hooks/useWordPressConnection';
import { useConnectionSync } from '@/hooks/useConnectionSync';
import { validateAndFilterComponents } from '@/utils/enhancedComponentValidation';

interface CentralizedLoadingState {
  phase: 'initializing' | 'authenticating' | 'fetching' | 'validating' | 'ready' | 'error';
  isReady: boolean;
  displayComponents: any[];
  error: string | null;
  connectionInfo: {
    isConnected: boolean;
    activeConnection: any;
    totalConnections: number;
  };
}

export const useCentralizedComponentLoading = () => {
  const [state, setState] = useState<CentralizedLoadingState>({
    phase: 'initializing',
    isReady: false,
    displayComponents: [],
    error: null,
    connectionInfo: {
      isConnected: false,
      activeConnection: null,
      totalConnections: 0
    }
  });

  const initializationRef = useRef(false);
  const { loadPage } = useWordPressConnection();
  
  const {
    config,
    isConnected,
    setIsFastLoading,
    setFastLoadingPage,
    setLoadedPage,
    setHasNextPage,
    getAllLoadedComponents,
    resetConnection
  } = useWordPressStore();

  const {
    connections,
    getActiveConnection,
    isLoading: connectionsLoading
  } = useConnectionsStore();

  const { selectedCategories } = useMultiConnectionData();
  
  // Enhanced connection sync with immediate effect
  const { syncConnection, isInSync } = useConnectionSync();

  // Single centralized initialization that handles everything
  const initializeEverything = useCallback(async () => {
    if (initializationRef.current) {
      console.log('🔄 Initialization already in progress, skipping...');
      return;
    }
    
    initializationRef.current = true;
    console.log('🚀 === CENTRALIZED LOADING START ===');

    try {
      // Phase 1: Wait for connections to load if needed
      if (connectionsLoading) {
        setState(prev => ({ ...prev, phase: 'initializing' }));
        console.log('⏳ Waiting for connections to load...');
        return; // Will be retriggered when connectionsLoading becomes false
      }

      // Phase 2: Connection validation and sync
      setState(prev => ({ ...prev, phase: 'authenticating' }));
      
      // Validate we have connections
      if (connections.length === 0) {
        setState(prev => ({
          ...prev,
          phase: 'error',
          error: 'No connections available',
          connectionInfo: { isConnected: false, activeConnection: null, totalConnections: 0 }
        }));
        return;
      }

      // Force connection sync first
      console.log('🔄 Forcing connection sync...');
      const syncResult = syncConnection();
      
      if (!syncResult) {
        throw new Error('Connection synchronization failed');
      }

      // Get current active connection
      const activeConnection = getActiveConnection();
      if (!activeConnection) {
        setState(prev => ({
          ...prev,
          phase: 'error',
          error: 'No active connection found',
          connectionInfo: { isConnected: false, activeConnection: null, totalConnections: connections.length }
        }));
        return;
      }

      // Validate connection status
      if (activeConnection.status !== 'connected') {
        setState(prev => ({
          ...prev,
          phase: 'error',
          error: `Connection is not established (status: ${activeConnection.status})`,
          connectionInfo: { isConnected: false, activeConnection, totalConnections: connections.length }
        }));
        return;
      }

      // Phase 3: Fetching with enhanced validation
      setState(prev => ({ 
        ...prev, 
        phase: 'fetching',
        connectionInfo: { isConnected: true, activeConnection, totalConnections: connections.length }
      }));

      // Enhanced configuration validation
      if (!config.baseUrl || !config.postType) {
        throw new Error('Missing configuration: baseUrl and postType required after sync');
      }

      console.log('✅ Configuration validated:', {
        baseUrl: config.baseUrl,
        postType: config.postType,
        isConnected: isConnected
      });

      // Configure fast loading
      setIsFastLoading(true);
      setFastLoadingPage(0);

      // Load first page with enhanced error handling
      console.log('📥 Loading first page...');
      const result = await loadPage(1);
      
      if (!result || !result.components || !Array.isArray(result.components)) {
        throw new Error('Invalid response from WordPress connection: missing or invalid components array');
      }

      console.log('✅ First page loaded successfully:', {
        componentCount: result.components.length,
        hasNextPage: result.hasNextPage
      });

      // Store loaded data
      setLoadedPage(1, result.components);
      setFastLoadingPage(1);
      setHasNextPage(result.hasNextPage || false);

      // Phase 4: Validation
      setState(prev => ({ ...prev, phase: 'validating' }));
      
      const validationResult = validateAndFilterComponents(result.components, selectedCategories);
      
      console.log('✅ Validation completed:', {
        total: result.components.length,
        valid: validationResult.validComponents.length,
        selectedCategories: selectedCategories.length
      });

      // Phase 5: Ready
      setState(prev => ({
        ...prev,
        phase: 'ready',
        isReady: true,
        displayComponents: validationResult.validComponents,
        error: null
      }));

      console.log('🎉 === CENTRALIZED LOADING SUCCESS ===');

    } catch (error) {
      console.error('❌ Centralized loading failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setState(prev => ({
        ...prev,
        phase: 'error',
        error: errorMessage,
        isReady: false,
        displayComponents: []
      }));
    } finally {
      initializationRef.current = false;
    }
  }, [
    connectionsLoading,
    connections.length,
    getActiveConnection,
    config.baseUrl,
    config.postType,
    isConnected,
    selectedCategories,
    loadPage,
    setIsFastLoading,
    setFastLoadingPage,
    setLoadedPage,
    setHasNextPage,
    syncConnection
  ]);

  // Load next page function
  const loadNextPage = useCallback(async () => {
    if (state.phase !== 'ready') {
      console.log('⚠️ Cannot load next page, not in ready state:', state.phase);
      return false;
    }

    try {
      const currentPage = useWordPressStore.getState().fastLoadingPage;
      const nextPage = currentPage + 1;
      
      console.log(`📥 Loading page ${nextPage}...`);
      const result = await loadPage(nextPage);
      
      if (!result || !result.components) {
        console.log(`⚠️ No more pages available after page ${currentPage}`);
        return false;
      }

      // Store new page
      setLoadedPage(nextPage, result.components);
      setFastLoadingPage(nextPage);
      setHasNextPage(result.hasNextPage || false);

      // Revalidate all components
      const allComponents = getAllLoadedComponents();
      const validationResult = validateAndFilterComponents(allComponents, selectedCategories);

      setState(prev => ({
        ...prev,
        displayComponents: validationResult.validComponents
      }));

      console.log(`✅ Page ${nextPage} loaded successfully`);
      return true;
    } catch (error) {
      console.error('❌ Failed to load next page:', error);
      return false;
    }
  }, [state.phase, loadPage, selectedCategories, setLoadedPage, setFastLoadingPage, setHasNextPage, getAllLoadedComponents]);

  // Enhanced reload function
  const reload = useCallback(() => {
    console.log('🔄 Reloading centralized component loading...');
    
    // Reset everything
    resetConnection();
    initializationRef.current = false;
    
    setState({
      phase: 'initializing',
      isReady: false,
      displayComponents: [],
      error: null,
      connectionInfo: {
        isConnected: false,
        activeConnection: null,
        totalConnections: 0
      }
    });
    
    // Force sync and reinitialize
    setTimeout(() => {
      syncConnection();
      initializeEverything();
    }, 100);
  }, [initializeEverything, resetConnection, syncConnection]);

  // Single initialization effect that handles all loading states
  useEffect(() => {
    const shouldInitialize = !initializationRef.current && 
                            state.phase === 'initializing' &&
                            (!connectionsLoading || connections.length > 0);
    
    console.log('🔄 Unified initialization effect check:', {
      shouldInitialize,
      connectionsLoading,
      connectionsCount: connections.length,
      isInSync,
      hasConfig: !!(config.baseUrl && config.postType),
      phase: state.phase,
      isInitializing: initializationRef.current
    });
    
    if (shouldInitialize) {
      console.log('🚀 Starting unified centralized initialization...');
      initializeEverything();
    }
  }, [connectionsLoading, connections.length, isInSync, config.baseUrl, config.postType, state.phase, initializeEverything]);

  // Category filter effect
  useEffect(() => {
    if (state.isReady && state.displayComponents.length > 0) {
      console.log('🔄 Reapplying filters due to category change...');
      
      const allComponents = getAllLoadedComponents();
      const validationResult = validateAndFilterComponents(allComponents, selectedCategories);
      
      setState(prev => ({
        ...prev,
        displayComponents: validationResult.validComponents
      }));
    }
  }, [selectedCategories, state.isReady, getAllLoadedComponents]);

  return {
    ...state,
    loadNextPage,
    reload,
    hasNextPage: useWordPressStore.getState().hasNextPage,
    isFetchingNextPage: useWordPressStore.getState().isFetchingNextPage
  };
};
