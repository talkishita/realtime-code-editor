import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import ACTIONS from "../Actions";
import Client from "../components/Client";
import Editor from "../components/Editor";
import { initSocket } from "../socket";
import OutlinedInput from "@mui/material/OutlinedInput";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Button from "@mui/material/Button";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import {
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from "react-router-dom";
import { CircularProgress } from "@mui/material";
import { executeCode } from "../runCodeApi";

const EditorPage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState([""]);
  const [language, setLanguage] = useState("javascript");
  const [compiling, setCompiling] = useState(false);
  const isInitialRender1 = useRef(true);
  const isInitialRender2 = useRef(true);
  const [runClicked,setRunClicked] = useState(false);

  const allLanguages = ["javascript", "python", "php"];

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      // Listening for joined event
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (socketId !== location.state?.username) {
            toast.success(`${username} joined the room.`);
            console.log(`${username} joined`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            output: output,
            language: language,
            socketId,
          });
        }
      );

      // Listening for disconnected
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });
    };
    init();
    return () => {
      socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
    };
  }, []);

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Could not copy the Room ID");
      console.error(err);
    }
  }

  function leaveRoom() {
    reactNavigator("/");
  }

  async function runCode() {
    setCompiling(true);
    setRunClicked(true);
    const currCode = codeRef.current;
    const {run:result} = await executeCode(language, currCode);
    setCompiling(false);
    const opt = result.output;
    console.log("output : ", opt);
    setOutput(opt);
  
  }

  const langChange = (event) => {
    const {
      target: { value },
    } = event;
    setLanguage(value);
  };

  useEffect(() => {
    if(isInitialRender1.current){
      isInitialRender1.current=false;
      return;
    }
    socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
      roomId,
      language
    });
  }, [language]);

  useEffect(() => {
    if(isInitialRender2.current || runClicked==false){
      isInitialRender2.current=false;
      return;
    }
    socketRef.current.emit(ACTIONS.OUTPUT_CHANGE, {
      roomId,
      output
    });
    setRunClicked(false);
  }, [output]);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.OUTPUT_CHANGE, ({ output }) => {
        if (output !== null && language != undefined) {
          setOutput(output);
        }
      });
      socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({ language }) => {
        if (language !== null && language != undefined) {
          setLanguage(language);
        }
      });
    }

    return () => {
      socketRef.current.off(ACTIONS.OUTPUT_CHANGE);
      socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
    };
  }, [socketRef.current]);

  if (!location.state) {
    return <Navigate to="/" />;
  }

  return (
    <>
      <div className="mainWrap">
        <div className="editorWrap">
          <Editor
            socketRef={socketRef}
            roomId={roomId}
            onCodeChange={(code) => {
              codeRef.current = code;
            }}
            language={language}
          />
        </div>
        <div className="consoleWrap">
          <div className="outputHeader">
            <h2 className="outputHeading">Output</h2>
            <div className="runLangButton">
              <div className="langButton">
                <Select
                  labelId="demo-multiple-name-label"
                  id="demo-multiple-name"
                  value={language}
                  onChange={langChange}
                  input={<OutlinedInput />}
                  style={{
                    color: "black",
                    backgroundColor: "white",
                    "font-weight": "bold",
                    height: "40px",
                    width: "150px",
                  }}
                >
                  {allLanguages.map((lang) => (
                    <MenuItem key={lang} value={lang}>
                      {lang}
                    </MenuItem>
                  ))}
                </Select>
              </div>
              <div className="runButton">
                {compiling ? (
                  <Button
                    variant="contained"
                    disabled
                    startIcon={<CircularProgress size={20} />}
                    style={{
                      border: "1px solid rgb(21,101,192)",
                      color: "white",
                    }}
                  >
                    Run Code
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => runCode()}
                    startIcon={<PlayArrowIcon />}
                  >
                    Run Code
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="outputArea">
            <pre>{output}</pre>
          </div>
        </div>
        <div className="aside">
          <div className="asideInner">
            <div className="logo">
            <div className='coditor'>
                <h1>CODITOR </h1>
                </div>
            </div>
            <h3>Connected</h3>
            <div className="clientsList">
              {clients.map((client) => (
                <Client key={client.socketId} username={client.username} />
              ))}
            </div>
          </div>
          <button className="btn copyBtn" onClick={copyRoomId}>
            Copy ROOM ID
          </button>
          <button className="btn leaveBtn" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </div>
    </>
  );
};

export default EditorPage;
