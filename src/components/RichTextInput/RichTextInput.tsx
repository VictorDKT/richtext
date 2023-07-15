import React, { useCallback, useEffect, useMemo, useState } from 'react';
import isHotkey from 'is-hotkey';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUnlink, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { Editable, withReact, useSlate, Slate, useSlateStatic, ReactEditor, useSelected, useFocused } from 'slate-react';
import {
  Editor,
  Transforms,
  createEditor,
  Descendant,
  Path,
  Element as SlateElement,
  BaseElement,
  Node as NodeSlate,
} from 'slate';
import { withHistory } from 'slate-history';
import { Button, Icon, Toolbar } from './Components';
import "./RichTextInput.css";
import imageExtensions from 'image-extensions';
import isUrl from 'is-url';
import { css } from '@emotion/css';

const HOTKEYS = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+`': 'code',
}

const LIST_TYPES = ['numbered-list', 'bulleted-list']
const TEXT_ALIGN_TYPES = ['left', 'center', 'right', 'justify']

interface IRichTextInputProps {
  onChange: (value: Descendant[])=>void;
  defaultValue?: Descendant[];
}

export type ImageElement = {
  type: 'image'
  url: string
  children: EmptyText[]
}

export type EmptyText = {
  text: string
}

const RichText = (props: IRichTextInputProps) => {
  const renderElement = useCallback(props => {
    if(props.element.type === "image") {
      return (
        <Image {...props} />
      )
    } else if(props.element.type === "link") {
      return (
        <Link {...props} />
      )
    } else if(props.element.type === "video") {
      return (
        <VideoElement {...props} />
      )
    } else {
      return (
        <Element {...props} />
      )
    }
  }, [])
  const renderLeaf = useCallback(props => <Leaf {...props} />, [])
  const editor = useMemo(() => withEmbeds(withImages(withHistory(withReact(createEditor())))), [])

  return (
    <Slate 
      editor={editor} 
      value={props.defaultValue ? props.defaultValue : ([{
        type: 'paragraph',
        children: [
          { text: '' },
        ]
      }] as unknown as Descendant[])} 
      onChange={(e)=>{props.onChange(e)}}
    >
      <Toolbar>
        <MarkButton format="bold" icon="format_bold" />
        <MarkButton format="italic" icon="format_italic" />
        <MarkButton format="underline" icon="format_underlined" />
        <MarkButton format="code" icon="code" />
        <BlockButton format="heading-one" icon="looks_one" />
        <BlockButton format="heading-two" icon="looks_two" />
        <BlockButton format="block-quote" icon="format_quote" />
        <BlockButton format="numbered-list" icon="format_list_numbered" />
        <BlockButton format="bulleted-list" icon="format_list_bulleted" />
        <BlockButton format="left" icon="format_align_left" />
        <BlockButton format="center" icon="format_align_center" />
        <BlockButton format="right" icon="format_align_right" />
        <BlockButton format="justify" icon="format_align_justify" />
        <InsertImageButton/>
        <InsertVideoButton/>
        <LinkButton format="justify" icon="link" />
      </Toolbar>
      <Editable
        style={{padding: "0px 20px", fontSize: "18px"}}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        placeholder={"Insira um texto"}
        spellCheck={false}
        autoFocus
        onKeyDown={event => {
          for (const hotkey in HOTKEYS) {
            if (isHotkey(hotkey, event as any)) {
              event.preventDefault()
              const mark = HOTKEYS[hotkey]
              toggleMark(editor, mark)
            }
          }
        }}
      />
    </Slate>
  )
}

const toggleBlock = (editor, format) => {
  const isActive = isBlockActive(
    editor,
    format,
    TEXT_ALIGN_TYPES.includes(format) ? 'align' : 'type'
  )
  const isList = LIST_TYPES.includes(format)

  Transforms.unwrapNodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      LIST_TYPES.includes((n as unknown as Record<string, string>).type) &&
      !TEXT_ALIGN_TYPES.includes(format),
    split: true,
  })
  let newProperties: Partial<SlateElement>
  if (TEXT_ALIGN_TYPES.includes(format)) {
    newProperties = {
      align: isActive ? undefined : format,
    } as Partial<BaseElement>
  } else {
    newProperties = {
      type: isActive ? 'paragraph' : isList ? 'list-item' : format,
    } as Partial<BaseElement>
  }
  Transforms.setNodes<SlateElement>(editor, newProperties)

  if (!isActive && isList) {
    const block = { type: format, children: [] }
    Transforms.wrapNodes(editor, block)
  }
}

const toggleMark = (editor, format) => {
  const isActive = isMarkActive(editor, format)

  if (isActive) {
    Editor.removeMark(editor, format)
  } else {
    Editor.addMark(editor, format, true)
  }
}

const isBlockActive = (editor, format, blockType = 'type') => {
  const { selection } = editor
  if (!selection) return false

  const [match] = Array.from(
    Editor.nodes(editor, {
      at: Editor.unhangRange(editor, selection),
      match: n =>
        !Editor.isEditor(n) &&
        SlateElement.isElement(n) &&
        n[blockType] === format,
    })
  )

  return !!match
}

const isMarkActive = (editor, format) => {
  const marks = Editor.marks(editor)
  return marks ? marks[format] === true : false
}

const Element = ({ attributes, children, element }) => {
  const style = { textAlign: element.align }
  switch (element.type) {
    case 'block-quote':
      return (
        <blockquote className={"blockquote"} style={style} {...attributes}>
          {children}
        </blockquote>
      )
    case 'bulleted-list':
      return (
        <ul style={style} {...attributes}>
          {children}
        </ul>
      )
    case 'heading-one':
      return (
        <h1 style={style} {...attributes}>
          {children}
        </h1>
      )
    case 'heading-two':
      return (
        <h2 className={"heading-two"} style={style} {...attributes}>
          {children}
        </h2>
      )
    case 'list-item':
      return (
        <li style={style} {...attributes}>
          {children}
        </li>
      )
    case 'numbered-list':
      return (
        <ol style={style} {...attributes}>
          {children}
        </ol>
      )
    default:
      return (
        <p style={{...style, marginBottom: "0.4em"}} {...attributes}>
          {children}
        </p>
      )
  }
}

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>
  }

  if (leaf.code) {
    children = <code className={"code"}>{children}</code>
  }

  if (leaf.italic) {
    children = <em>{children}</em>
  }

  if (leaf.underline) {
    children = <u>{children}</u>
  }

  if (leaf.href) {
    children = <a className={"link"} onClick={()=>{window.open(leaf.href)}}>{children}</a>
  }

  return <span {...attributes}>{children}</span>
}

const BlockButton = ({ format, icon }) => {
  const editor = useSlate()
  return (
    <Button
      active={isBlockActive(
        editor,
        format,
        TEXT_ALIGN_TYPES.includes(format) ? 'align' : 'type'
      )}
      onMouseDown={event => {
        event.preventDefault()
        toggleBlock(editor, format)
      }}
    >
      <Icon>{icon}</Icon>
    </Button>
  )
}

const MarkButton = ({ format, icon }) => {
  const editor = useSlate()
  return (
    <Button
      active={isMarkActive(editor, format)}
      onMouseDown={event => {
        event.preventDefault()
        toggleMark(editor, format)
      }}
    >
      <Icon>{icon}</Icon>
    </Button>
  )
}

const LinkButton = ({ format, icon }) => {
  const editor = useSlate();
  const [showTooltip, setShowTooltip] = useState(false);
  const [control, setControl] = useState(Math.floor(Math.random() * 99999));
  const [text, setText] = useState("");
  const [link, setLink] = useState("");

  function handleClickOutside(e: MouseEvent) {
    const elem = document.getElementById("link-button-"+control.toString()) as HTMLElement
    if(elem) {
      if(!elem.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
  }

  useEffect(()=>{
    window.addEventListener('click', handleClickOutside, false)
  }, [])

  return (
    <div id={"link-button-"+control.toString()}>
      <Button 
        onClick={()=>{setShowTooltip(!showTooltip)}}
      >
        <Icon>{icon}</Icon>
      </Button>
      {showTooltip &&
        <div id={control.toString()} className={"button-tooltip"}>
          <div>Text:</div>
          <input className={'tooltip-input'} onChange={(e)=>{setText(e.target.value)}} placeholder={"Enter link text"}/>
          <div>Link:</div>
          <input className={'tooltip-input'} onChange={(e)=>{setLink(e.target.value)}} placeholder={"Insert a link"}/>
          <div className={"tooltip-footer"}>
            <button className={"tooltip-footer-button"} onClick={()=>{handleInsertLink(editor, link, text); setShowTooltip(false)}} >Confirm</button>
          </div>
        </div>
      }
    </div>
  )
}

const Link = ({ attributes, element, children }) => {
  const editor = useSlateStatic();
  const selected = useSelected();

  return (
    <div className={"element-link"}>
      <a className={"link"} {...attributes} href={element.href}>
        {children}
      </a>
      { selected === true &&
        <div className={"popup"} contentEditable={false}>
          <a className={"href"} href={element.href} rel="noreferrer" target="_blank">
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            {element.href}
          </a>
          <button onClick={() => removeLink(editor)}>
            <FontAwesomeIcon icon={faUnlink} />
          </button>
        </div>
      }
    </div>
  );
};

const handleInsertLink = (editor, url, text) => {
  insertLink(editor, url, text);
};

const insertLink = (editor, url, text) => {
  if (!url) return;

  const { selection } = editor;

  ReactEditor.focus(editor);
  
  if (!!selection) {
    const [parentNode, parentPath] = Editor.parent(
      editor,
      selection.focus?.path
    );
    if (editor.isVoid(parentNode)) {
      Transforms.insertFragment(editor, [{
        href: url,
        text: text,
        type: "link",
      }] as unknown as NodeSlate[], {
        at: Path.next(parentPath)
      })
      Transforms.insertFragment(editor, [{
        text: " ",
      }], {
        at: Path.next(parentPath)
      })
    } else {
      Transforms.insertFragment(editor, [{
        href: url,
        text:  text,
        type: "link"
      }] as unknown as NodeSlate[])
      Transforms.insertFragment(editor, [{
        text: " ",
      }])
    }
  } else {
    Transforms.insertFragment(editor, [{
      href: url,
      text:  text,
      type: "link"
    }] as unknown as NodeSlate[])
    Transforms.insertFragment(editor, [{
      text: " ",
    }])
  }
};

const removeLink = (editor, opts = {}) => {
  Transforms.unwrapNodes(editor, {
    ...opts,
    match: (n) =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && (n as unknown as Record<string, string>).type === "link"
  });
};

const createParagraphNode = (children = [{ text: "" }]) => ({
  type: "paragraph",
  children
});

function RichTextInput(props: IRichTextInputProps) {
  return (
    <div className={"rich-text-box"}>
      <div>
        <RichText
          {...props}
        />
      </div>
    </div>
  )
}

const isImageUrl = url => {
  if (!url) return false
  if (!isUrl(url)) return false
  const ext = new URL(url).pathname.split('.').pop()
  return imageExtensions.includes(ext)
}

const InsertImageButton = () => {
  const editor = useSlateStatic()
  const [showTooltip, setShowTooltip] = useState(false);
  const [control, setControl] = useState(Math.floor(Math.random() * 99999));
  const [imagem, setImagem] = useState("");
  const [activeTab, setActiveTab] = useState("upload");
  const [imageFile, setImageFile] = useState<string>();

  function handleClickOutside(e: MouseEvent) {
    const elem = document.getElementById("imagem-button-"+control.toString()) as HTMLElement
    if(elem) {
      if(!elem.contains(e.target as Node)) {
        setShowTooltip(false)
        setImageFile("")
      }
    }
  }

  useEffect(()=>{
    window.addEventListener('click', handleClickOutside, false)
  }, [])

  return (
    <div id={"imagem-button-"+control.toString()} >
      <Button
        onClick={()=>{
          setShowTooltip(!showTooltip); 
          setImageFile("");
        }}
      >
        <Icon>image</Icon>
      </Button>
      {showTooltip &&
        <div id={control.toString()} className={"button-tooltip"}>
          <div style={{marginBottom: "5px"}}>Image:</div>
          <div className={"tooltip-header"}>
            <div 
              className={activeTab === "upload" ? "tooltip-header-tab-active" : "tooltip-header-tab"}
              onClick={()=>{setActiveTab("upload")}}
            >
              Upload
            </div>
            <div 
              className={activeTab === "link" ? "tooltip-header-tab-active" : "tooltip-header-tab"}
              onClick={()=>{setActiveTab("link")}}
            >
              Link
            </div>
          </div>
          {activeTab === "link" ?
            <div>
              <input className={'tooltip-input'} onChange={(e)=>{setImagem(e.target.value)}} placeholder={"Insert image link"}/>
              <div className={"tooltip-footer"}>
                <button 
                  className={"tooltip-footer-button"} 
                  onClick={()=>{
                    if (imagem && !isImageUrl(imagem)) {
                      alert('URL is not an image')
                      return
                    }
                    imagem && insertImage(editor, imagem)
                    setShowTooltip(false);
                  }} 
                >
                  Confirm
                </button>
              </div>
            </div>
          :
            <div style={{width: "170px"}}>
              <input 
                id="image-upload" 
                type="file" 
                style={{display:"none"}} 
                accept=".jpg,.png,.gif,.jpeg," 
                onChange={(e)=>{
                  const fileData = e.target.value.split("\\")
                  setImageFile(fileData[fileData.length-1])
                }}
              />
              <button 
                className={"tooltip-upload-button"}
                onClick={()=>{document.getElementById("image-upload").click()}}
              >
                Choose image
              </button>
              <div>{imageFile}</div>
              <div className={"tooltip-footer"}>
                <button 
                  className={"tooltip-footer-button"} 
                  onClick={async ()=>{
                    const file = (document.getElementById("image-upload") as HTMLInputElement).files[0];
                    if(file) {
                      const reader = new FileReader();
                      reader.readAsDataURL(file);
                      reader.onload = async function () {
                        const image = reader.result;
                        image && insertImage(editor, image)
                        setShowTooltip(false)
                      };
                      reader.onerror = function (error) {
                        console.log('Error: ', error);
                      };
                    }
                  }} 
                >
                  Confirm
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  )
}

const insertImage = (editor, url) => {
  const text = { text: '' }
  const image: ImageElement = { type: 'image', url, children: [text] }
  const paragraph = createParagraphNode()
  Transforms.insertNodes(editor, image)
  Transforms.insertNodes(editor, paragraph)
}

const Image = ({ attributes, children, element }) => {
  const editor = useSlateStatic()
  const path = ReactEditor.findPath(editor as ReactEditor, element)

  const selected = useSelected()
  const focused = useFocused()
  return (
    <div {...attributes}>
      {children}
      <div
        contentEditable={false}
        className={css`
          position: relative;
        `}
      >
        <img
          alt={"custom-img"}
          src={element.url}
          className={css`
            display: block;
            width: 100%;
            box-shadow: ${selected && focused ? '0 0 0 3px #B4D5FF' : 'none'};
          `}
        />
        <Button
          active
          onClick={() => Transforms.removeNodes(editor, { at: path })}
          className={css`
            display: ${selected && focused ? 'inline' : 'none'};
            position: absolute;
            top: 0.5em;
            left: 0.5em;
            background-color: white;
          `}
        >
          <Icon>delete</Icon>
        </Button>
      </div>
    </div>
  )
}

const withImages = editor => {
  const { insertData, isVoid } = editor

  editor.isVoid = element => {
    return element.type === 'image' ? true : isVoid(element)
  }

  editor.insertData = data => {
    const text = data.getData('text/plain')
    const { files } = data

    if (files && files.length > 0) {
      for (const file of files) {
        const reader = new FileReader()
        const [mime] = file.type.split('/')

        if (mime === 'image') {
          reader.addEventListener('load', () => {
            const url = reader.result
            insertImage(editor, url)
          })

          reader.readAsDataURL(file)
        }
      }
    } else if (isImageUrl(text)) {
      insertImage(editor, text)
    } else {
      insertData(data)
    }
  }

  return editor
}

const InsertVideoButton = () => {
  const editor = useSlateStatic()
  const [showTooltip, setShowTooltip] = useState(false);
  const [control, setControl] = useState(Math.floor(Math.random() * 99999));
  const [video, setVideo] = useState("");

  function handleClickOutside(e: MouseEvent) {
    const elem = document.getElementById("video-button-"+control.toString()) as HTMLElement
    if(elem) {
      if(!elem.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
  }

  useEffect(()=>{
    window.addEventListener('click', handleClickOutside, false)
  }, [])

  return (
    <div id={"video-button-"+control.toString()} >
      <Button
        onClick={()=>{setShowTooltip(!showTooltip)}}
      >
        <Icon>play_circle</Icon>
      </Button>
      {showTooltip &&
        <div id={control.toString()} className={"button-tooltip"}>
          <div>Video:</div>
          <input className={'tooltip-input'} onChange={(e)=>{setVideo(e.target.value)}} placeholder={"Insert video link"}/>
          <div className={"tooltip-footer"}>
            <button 
              className={"tooltip-footer-button"} 
              onClick={()=>{
                insertVideo(editor,video);
                setShowTooltip(false);
              }} 
            >
              Confirm
            </button>
          </div>
        </div>
      }
    </div>
  )
}

const insertVideo = (editor, url) => {
  const text = { text: '' }
  const video = { type: 'video', url: formatYoutubeUrl(url), children: [text] }
  const paragraph = createParagraphNode()
  Transforms.insertNodes(editor, video)
  Transforms.insertNodes(editor, paragraph)
}

const formatYoutubeUrl = (url)=>{
  if(url.includes("youtu.be")) {
    const urlElements = url.split("/");
    const videoCode = urlElements[urlElements.length-1];
    url = "https://www.youtube.com/embed/"+videoCode;
  } else if(url.includes("youtube")) {
    const urlElements = url.split("=");
    const videoCode = urlElements[urlElements.length-1];
    url = "https://www.youtube.com/embed/"+videoCode;
  }

  return url;
}

const withEmbeds = editor => {
  const { isVoid } = editor
  editor.isVoid = element => (element.type === 'video' ? true : isVoid(element))
  return editor
}

const VideoElement = ({ attributes, children, element }) => {
  const { url } = element;

  return (
    <div {...attributes}>
      <div contentEditable={false}>
        <div>
          <iframe
            title={"video"}
            src={`${url}?title=0&byline=0&portrait=0`}
            frameBorder="0"
            style={{
              top: '0',
              left: '0',
              width: '100%',
              height: '500px',
            }}
          />
        </div>
      </div>
      {children}
    </div>
  )
}

export default RichTextInput;