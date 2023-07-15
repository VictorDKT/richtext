import React from 'react';
import { Descendant } from 'slate';
import RichTextInput from './components/RichTextInput/RichTextInput';

function App() {
  return (
    <div className="App">
      <div
        style={{
          display: 'flex',
          justifyContent: "center",
          marginTop: "50px"
        }}
      >
        <div style={{width: "700px"}}>
          <RichTextInput
            onChange={(value: Descendant[])=>{
              console.log("va", value)
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
