import { t } from "../i18n/index.js";
import { useEffect, useState } from "react";
import api from "../api/client";
import { OPTIONAL_AUTH_MODE } from "../api/authPolicy";
export default function useHomeShelves() {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: ""
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get("/store/home/", {
      signal: controller.signal,
      authMode: OPTIONAL_AUTH_MODE
    }).then(({
      data
    }) => setState({
      data,
      loading: false,
      error: ""
    })).catch(err => {
      if (!controller.signal.aborted) setState({
        data: null,
        loading: false,
        error: err.response?.data?.detail || t("Unable to load store shelves.")
      });
    });
    return () => controller.abort();
  }, [attempt]);
  return {
    ...state,
    retry: () => {
      setState(current => ({
        ...current,
        loading: true
      }));
      setAttempt(n => n + 1);
    }
  };
}
