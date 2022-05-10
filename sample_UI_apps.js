'use strict';

/**
 * @UTILITIES
 */
function getRandomColor() {
    let letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 4; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color + 'EE';
}

/**
 * @functions UserActionHandlers
 * 1. Search action
 *      - Listener and handler,
 *      (1) Explicitly saying "search :content"
 *      (2) Focusing and starting typing on "search" GUI segment and click enter key
 *      - Do,
 *      (1) Tell background search action invoked on the segment -> in background, store page's behavior context
 *      (2) (When background respond) Do action
 *      
 * 2. Focus and input action (between GUI segment)
 *      (1) If focused segment is "Form" related segment
 *          - When user start to input some text, automatically targering input node
 * 
 * 3. Navigate action (Select one item in container of navigator segment)
 *      (1) If focused segment is "Navigation" related segment
 *          - When user start to enter inside the container (by '+' key) and select some item,
 *              tell background navigate action invoked on the segment and the corresponding index
 * 
 * Focus, Select, Input
 * 
 */


// Invoking previous page context, which is of back page or previous activated tab
function invokePreviousPageContext() {
    chrome.runtime.sendMessage({
        method: "invokePreviousPageContext",
        params: {
            url: location.href
        }
    }, function (response) {

        // TODO response에 previous context가 다른 탭인지 아니면 이전 페이지인지 담아서 받아오기

        // 1. Move to other tab

        // 2. Move to back page whenever background knows that tab is about to move back
        window.history.back();

        return;
    });
}

function updateUserActionTarget(segment_index, subnode_index = null) {
    chrome.runtime.sendMessage({
        method: "updateUserAction",
        params: {
            segment_index: segment_index,
            subnode_index: subnode_index
        }
    }, function (response) {
        return;
    });
}

function SearchActionHandler(segment, index) {
    const segment_index = index;
    if (!segment.inputNode) return null;
    // const inputNode = segment.inputNode;
    const inputNodeRect = segment.inputNodeRect;

    // By assistive techs
    this.focus = function () {
        dispatchClickByDevtools(inputNodeRect);
    }

    // By speech, Focus and input on inputNode
    this.action = function (searchText) {
        updateUserActionTarget(segment_index);
        dispatchSubmitByDevtools(inputNodeRect, searchText);
    }
}

function NavigationActionHandler(segment, index) {
    const segment_index = index;
    if (!segment.containerNode || !segment.containerItems) return null;
    const containerItems = segment.containerItems; // Array

    // By assistive techs
    this.focus = function () {

    }

    // By speech, Focus and input on inputNode
    this.action = function (select_index) {
        // Dispatch click event on "link" node
        const selected_link_rect = (containerItems[select_index].linkNode) ? containerItems[select_index].linkRect : null;
        if (!selected_link_rect) {
            console.log("____[NavigationActionHandler Error]____Target link node not exists");
            return;
        }

        // Highlight click target
        const linkNode = containerItems[select_index].linkNode;
        const existingStyle = linkNode.getAttribute('style');
        if (existingStyle) {
            linkNode.setAttribute('style', existingStyle + `background-color: ${currentColor};`);
        } else {
            linkNode.setAttribute('style', `background-color: ${currentColor};`);
        }

        updateUserActionTarget(segment_index, select_index);
        dispatchClickByDevtools(selected_link_rect);
    }
}


/**@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
 * @Speech_Command_Interface
 * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
 */
// const number_orders = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
const number_orders = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// selecting target voca set
const SELECTING_TARGET_VOCA_MAP = function (src_word) {
    const synonym_map = new Map();
    synonym_map.set("search-results", ["search results", "search result", "result"]);
    synonym_map.set("items", ["item", "content", "entity", "object", "component", "playlist"]);
    synonym_map.set("menu", ["menu", "menus"]);
    synonym_map.set("tab-bar", ["tab"]);

    let target_word = null;
    synonym_map.forEach((voca_list, key) => {
        if (voca_list.includes(src_word)) return target_word = key;
    });

    return target_word;
}

// Callback function for search request
const searchCallback = function (content) {
    console.log("____[Speech Command Execute]____Search for", content);

    // Find search segments
    const searchCandidates = [];
    for (const segment of GUI_SEGMENTS) {
        const name = segment.detection.name;
        if (name == "search") searchCandidates.push(segment);
    }

    // TODO multiple search segments
    const searchSegment = (searchCandidates.length > 0) ? searchCandidates[0] : null;
    if (!searchSegment) {
        console.log("____[Speech Command Error]____Search segment not exists");
        return;
    }

    // Emulate search action
    searchSegment.userActionHandler.action(content);
};

/**
 * @function selectCallback SegmentType <content-list, content-grid, menu-bar, menu-panel, tab-bar>
 * @param {*} number
 * @param {*} sentence
 */
const selectCallback = function (sentence) { // target sentente will be "(number) + (target)"
    // 1. Find number
    const number_candidates = nlp(sentence).numbers().json();
    if (number_candidates.length <= 0) {
        console.log("____[NLP ERROR]____number not exists in sentence");
        return;
    }

    let select_index = -1;
    for (const number_obj of number_candidates) {
        select_index = number_orders.indexOf(number_obj.cardinal);
    }
    if (select_index < 0) return;
    console.log("____[NLP MATCHED]____number", select_index);

    // 2. Find target
    let target_word = null;
    const term_candidates = nlp(sentence).terms().out('array');
    for (const term of term_candidates) {
        target_word = SELECTING_TARGET_VOCA_MAP(term);
        if (target_word) break;
    }
    if (!target_word) {
        console.log("____[NLP ERROR]____Selection target not exists in sentence");
        return;
    }
    console.log("____[NLP MATCHED]____Selction target", target_word);

    // Find target segment
    let targetSegment = null;
    switch (target_word) {
        case "search-results": { // type: content-list
            const candidates = getSegmentsByLabel("search-results");
            if (candidates.length > 0) targetSegment = candidates[0]; // only one segment with search-results label
            break;
        }
        case "items": { // content-list, content-grid
            const candidates = [];
            candidates.push(...getSegmentsByType("content-list"));
            candidates.push(...getSegmentsByType("content-grid"));

            // __TODO__ multiple items segments
            // naive approach - find biggest items segment
            const index = getLargestSegmentIndex(candidates);
            if (index > -1) targetSegment = candidates[index];
            break;
        }
        case "menu": { // menu-bar, menu-panel
            // TODO
            break;
        }
        case "tab-bar": { // tab-bar
            // TODO
            break;
        }
    }

    // __TODO__ menu, tab? or other segment like form?

    if (!targetSegment) {
        console.log("____[Speech Command Error]____Failed to find selection target segment");
        return;
    }

    console.log("____[Speech Command Execution]____Select", select_index, "index of", targetSegment);

    // Emulate select action
    targetSegment.userActionHandler.action(select_index);
}

const defaultCallback = function (sentence) {
    const numbers = nlp(target).numbers().json();
    console.log(numbers);
}

/**
 * Required command set for GUI segments
 * 
 * @Click
 *      1. Select container's item
 * 
 * @TEXT_INPUT
 *      2. Search ":text"
 *      3. Leave comment/chat as ":text"
 *      4. 
 */
const commands = {
    // ':number video play': playfunction,
    // 'play :number video': playfunction,


    'search *content': searchCallback,

    // '*sentence': defaultCallback,

    'select *target': selectCallback,
    'click *target': selectCallback,
    'play *target': selectCallback,
    // ':number *target': selectCallback,
    // 'select :number *target': selectCallback,
    // 'click :number *target': selectCallback,
    // 'play :number *target': selectCallback,

    // 'previous item': prev_function,
    // 'back next result': next_function
};
/**
 * @END_OF_Speech_Command_Interface
 */






/**@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
 * @Keyboard_navigation_interface
 * @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
 */
let keyboard_map = new Map();
let has_content_map = new Map();
let current_position;
let currentColor;
let prevStyleOfSelectedElement = null;
let temp_list = [];

function highlightNode_css(elem) {
    console.log(elem);
    prevStyleOfSelectedElement = elem.getAttribute('style');
    if (prevStyleOfSelectedElement) {
        elem.setAttribute('style', prevStyleOfSelectedElement + `background-color: ${currentColor};`);
    } else {
        elem.setAttribute('style', `background-color: ${currentColor};`);
    }
    elem.tabIndex = "-1";
    elem.focus();
}

function hideHighlight_css(elem) {
    if (prevStyleOfSelectedElement) {
        elem.setAttribute('style', prevStyleOfSelectedElement);
    } else {
        elem.removeAttribute('style');
    }
}

// 현재 객체 highlight 끄고, next position의 highlight 켜주기
function move_by_keyboard(cur_position, next_position) {
    hideHighlight_css(cur_position);
    highlightNode_css(next_position);
    current_position = next_position;
}

// keyboard 화살표 event에 대한 handling
let next_position;
let content_index = 0;
let container_list;
let target;

function keyboard_operation(key_input) {
    if (content_index == 0) {
        switch (key_input) {
            case "KeyA":
                next_position = keyboard_map.get(current_position).get_left();
                break;
            case "KeyD":
                next_position = keyboard_map.get(current_position).get_right();
                break;
            case "KeyW":
                next_position = keyboard_map.get(current_position).get_top();
                break;
            case "KeyS":
                next_position = keyboard_map.get(current_position).get_bottom();
                break;
        }
    }
    else if (has_content_map.get(current_position.parentNode)) {
        let pnode = keyboard_map.get(current_position.parentNode);
        switch (key_input) {
            case "KeyA":
                next_position = pnode.get_left();
                break;
            case "KeyD":
                next_position = pnode.get_right();
                break;
            case "KeyW":
                next_position = pnode.get_top();
                break;
            case "KeyS":
                next_position = pnode.get_bottom();
                break;
        }
        content_index = 0;
    }
    if (next_position != 0) {
        move_by_keyboard(current_position, next_position);
    }
}

window.addEventListener("keydown", (e) => {
    console.log(e);
    // if(e.key=="ArrowLeft" || e.key=="ArrowRight" || e.key=="ArrowUp" || e.key=="ArrowDown")
    // {
    //     keyboard_operation(e.key);
    // }
    if (e.code == "KeyA" || e.code == "KeyD" || e.code == "KeyW" || e.code == "KeyS") {
        keyboard_operation(e.code);
    }
    else if (e.key == "+") {
        if (content_index == 0) {
            container_list = has_content_map.get(current_position);
            if (container_list != undefined) {
                next_position = container_list[content_index].itemNode;
                next_position.setAttribute('parent', current_position);
                move_by_keyboard(current_position, next_position);
                content_index++;
            }
        }
        else {
            if (content_index < container_list.length) {
                next_position = container_list[content_index];
                move_by_keyboard(current_position, next_position.itemNode);
                content_index++;
            }
        }
    }
    else if (e.key == "Enter") {
        // e.preventDefault();
        let target_video = container_list[content_index - 1];
        target = target_video;
        target_video.linkNode.click();
    }
});
/**
 * @END_OF_Keyboard_navigation_interface
 */
 

function initSeamlisInterfaces() {

    // Init user action handler for each segment object
    GUI_SEGMENTS.forEach((segment, index) => {
        // Functional role: Search
        if (["search"].includes(segment.detection.name)) {
            console.log("UserActionHandler on search segment", segment);
            segment.userActionHandler = new SearchActionHandler(segment, index);
        }

        if (["content-list", "content-grid", "tab-bar", "menu-panel", "menu-bar"].includes(segment.detection.name)) {
            console.log("UserActionHandler on Navigation segment", segment);
            segment.userActionHandler = new NavigationActionHandler(segment, index);
        }
    });

    // keyboard_control_start(GUI_SEGMENTS);

    nlp.extend(compromiseNumbers);

    annyang.addCommands(commands);
    annyang.start({ autoRestart: true, continuous: true });
    annyang.debug();

    /*
        // Tell KITT to use annyang
        SpeechKITT.annyang();
    
        // Define a stylesheet for KITT to use
        SpeechKITT.setStylesheet('//cdnjs.cloudflare.com/ajax/libs/SpeechKITT/0.3.0/themes/flat.css');
    
        // Render KITT's interface
        SpeechKITT.vroom();
    */

    console.log("ANNYANG start");
    // let recognition = annyang.getSpeechRecognizer();
    // recognition.interimResults = true;
    /*
    recognition.onresult = function(event) {
        let interim_transcript = '';
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal)
            {
                final_transcript += event.results[i][0].transcript;
            } else 
            {
                interim_transcript += event.results[i][0].transcript;
            }
        }
        console.log('interim='+interim_transcript+'|final='+final_transcript);
    }
    */
}