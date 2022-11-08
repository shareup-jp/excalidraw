
import LanguageDetector from "i18next-browser-languagedetector";
import { useEffect, useRef } from "react";
import { useCallbackRefState } from "../hooks/useCallbackRefState";
import { Excalidraw, defaultLang } from "../packages/excalidraw/index";
import {
  resolvablePromise,
} from "../utils";

import {
  loadScene,
} from "./data";
import {
  getLibraryItemsFromStorage,
  importFromLocalStorage,
} from "./data/localStorage";
import "./index.scss";

import { newElementWith } from "../element/mutateElement";
import { LocalData } from "./data/LocalData";
import clsx from "clsx";
import { atom, useAtom } from "jotai";
import { useHandleLibrary } from "../data/library";

const languageDetector = new LanguageDetector();
languageDetector.init({
  languageUtils: {},
});

const initializeScene = async (opts) => {

  const localDataState = importFromLocalStorage();

  const scene = await loadScene(null, null, localDataState);

  // https://github.com/excalidraw/excalidraw/issues/1919
  if (document.hidden) {
    return new Promise((resolve, reject) => {
      window.addEventListener(
        "focus",
        () => initializeScene(opts).then(resolve).catch(reject),
        {
          once: true,
        },
      );
    });
  }

  if (scene) {
    return { scene };
  }
  return { scene: null };
};

const currentLangCode = languageDetector.detect() || defaultLang.code;

export const langCodeAtom = atom(
  Array.isArray(currentLangCode) ? currentLangCode[0] : currentLangCode,
);

const ExcalidrawWrapper = () => {
  const [langCode, setLangCode] = useAtom(langCodeAtom);

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef({ promise: null });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise = resolvablePromise();
  }

  const [excalidrawAPI, excalidrawRefCallback] = useCallbackRefState();

  useHandleLibrary({
    excalidrawAPI,
    getInitialLibraryItems: getLibraryItemsFromStorage,
  });

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    initializeScene({ excalidrawAPI }).then(async (data) => {
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

  }, [excalidrawAPI, setLangCode]);

  useEffect(() => {
    languageDetector.cacheUserLanguage(langCode);
  }, [langCode]);


  const onChange = (
    elements,
    appState,
    files,
  ) => {

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
            });
          }
        }
      });
    }
  };

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app")}
    >
      <Excalidraw
        ref={excalidrawRefCallback}
        onChange={onChange}
        initialData={initialStatePromiseRef.current.promise}
        // onCollabButtonClick={() => setCollabDialogShown(true)}
        // isCollaborating={isCollaborating}
        // onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              // onExportToBackend,
              // renderCustomUI: (elements, appState, files) => {
              //   return (
              //     <ExportToExcalidrawPlus
              //       elements={elements}
              //       appState={appState}
              //       files={files}
              //       onError={(error) => {
              //         excalidrawAPI?.updateScene({
              //           appState: {
              //             errorMessage: error.message,
              //           },
              //         });
              //       }}
              //     />
              //   );
              // },
            },
          },
        }}
        // renderFooter={renderFooter}
        langCode={langCode}
        // renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        // onLibraryChange={onLibraryChange}
        autoFocus={true}
        // theme={theme}
      />
    </div>
  );
};

const ExcalidrawApp = () => {
  return (
      <ExcalidrawWrapper />
  );
};

export default ExcalidrawApp;
