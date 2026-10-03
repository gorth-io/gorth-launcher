import { useEffect, useState } from "react";

function useFullScreen() {
  const [isFullScreen, setIsFullScreen] = useState(false);
  useEffect(() => {
    let mounted = true;
    void window.electronAPI.windowState.getIsFullScreen().then((value) => {
      if (mounted) setIsFullScreen(value);
    });
    const unsubscribe =
      window.electronAPI.windowState.onFullScreenChanged(setIsFullScreen);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  return isFullScreen;
}
export { useFullScreen };
