/***
 * @overview
 * Sumarry.
 *
 * Main functionalities of Evidente.
 * Concerns itself with the Uploading, the Vis. of SNPs, Filtering and Analysis
 *
 * Description.
 * Main functions of Evidente.
 * 4 Sections are given:
 * File Management: concerns itself with the uploading, exporting and parsing process.
 * SNP Visualization: Responsible functions for the SNP visualization .
 * Filtering: Functions that allow the filtering through the Metadata of the leaves
 * Statistics: The functions for the enrichment analysis
 *
 *
 *
 * @author Mathias Witte Paz mathiaswittepaz@gmail.com
 * @required html-functions.js
 * @required Libray_Phylocanvas.js
 */



document.getElementById("loader").style.display = "none";
let tree;


const MAX_VISUALIZE = 20;
const START_SNP_ID = 1;
const SIGNIFICANCE_LEVEL = [0.05, 0.01];


let NUM_FILES_LOADED=0;
let SNPid;
let VISUALIZING;
let TREE_FILE, DATA_FILE, ID_FILE, NON_DATA_FILE, BINARY,ADD_DATA_FILE, SNP_TABLE_FILE, SNP_EFFECT_FILE;
SNPid = START_SNP_ID;
[TREE_FILE, DATA_FILE, ID_FILE, NON_DATA_FILE, ADD_DATA_FILE, SNP_TABLE_FILE, SNP_EFFECT_FILE] = "";

//Array of SNPS being visualized
VISUALIZING = [];
//Categories in SNP_EFFECT_TABLE
SNP_EFFECT_TITLE = [];
//Different Types of Additional Information for the Nodes
BINARY = []; // For binary type information
STRINGS = {}; // For all strings
RANGES = {}; // For numerical and Dates data
GOA = {}; // Saves the descriptions of the GO IDS
ADDITIONAL_INFO = {}; // Joints all Additional information before sorting
ADDITIONAL_INFO_TYPES = {}; // Saves the Type of each Additional Information
SNPS_EFFECTS = []; //Saves the inforamtion of the effects of the SNPs
SNP_TABLE_DICT = {}; // Saves the SNPs in order to find which leaves have them.

let allNodes;
let saveMaxLabelLength = []; // Used to avoid problems with the labels of Phylocanvas

//Improves calculation of the logarithms by creating a cache
let f = [Decimal.ln(1), Decimal.ln(1)];
let flength = 2;
let cache = 200;
logfact(cache);


/**
Starts the program

*/
(function (Phylocanvas) {
    tree = Phylocanvas.createTree('phylocanvas');
    tree.disablezoom = false;
    tree.setTreeType('rectangular');
    tree.alignLabels = true;
    tree.on('beforeFirstDraw', function () {
        handleIDSelection(ID_FILE);
        handleSNPDataSelection(DATA_FILE, "D");
        handleSNPDataSelection(NON_DATA_FILE, "N");
        resetContainer(document.getElementById("multiple-select-binary"));
        resetContainer(document.getElementById("multiple-select-string"));
        resetContainer(document.getElementById("ranges"));
        resetContainer(document.getElementById("extras-filtering"));

        if (ADD_DATA_FILE !== undefined) // Additional Data File is not a must.
            handleAdditionalInfo(ADD_DATA_FILE);
        else
            $("#multiple-select-binary").append($("<span>No additional information loaded.</span>"));
        if (SNP_EFFECT_FILE !== undefined)
            SNPS_EFFECTS = handleSNPEffectSelection(SNP_EFFECT_FILE);
        else
            $("#collapse-snp-info").append($("<span>No SNP effect information loaded.</span>"));

    });
})(window.Phylocanvas);


let folder = document.getElementById("files-loader");
folder.onchange= function(){getFiles(this.id);};


/*********************************************************************************************************************
 *                       File Management
 ********************************************************************************************************************/

/**
 * Given the id of a MultipleFile reader it reads the files and sorts it correctly.
 * @param {String} id
 */
function getFiles(id){
    resetFiles();
    NUM_FILES_LOADED = 0;
    let folder = document.getElementById(id);
    let files = Array.from(folder.files);
    try {
        let len = files.length;
        let i;
        for(i=0;i<len;i++){
            sortType(files[i]);
            handleFilesSelection(files[i])
        }
        checkLoad(files,folder);
    }
    catch (e) {
        alert(e);
        showLoadedFiles(files)
    }
}

/**
 * Checks the status of the uploading, then show the tree.
 */
function checkLoad(files,folder) {
    if(NUM_FILES_LOADED !== folder.files.length) {
        // Checks if files are all uploaded, then shows the tree
        window.setTimeout(function(){checkLoad(files,folder)}, 300);
    } else {
        showLoadedFiles(files);
    }
}

/**
 * Creates a Modal that shows the user which files have been uploaded.
 * It gives him the possibility of Reload a Folder.
 * @param {FileReader} files
 */
function showLoadedFiles(files) {
    const modal = document.getElementById('modal-files');
    modal.style.display = "block";
    modal.style.zIndex = 2001;
    let modalContent = document.getElementById('files-list');
    resetContainer(modalContent);
    // Get the <span> element that closes the modal
    const span = document.getElementsByClassName("close")[1];
    // When the user clicks on <span> (x), close the modal
    span.onclick = function () {
        modal.style.display = "none";
    };
    createListOfFiles(files);
    let buttonStart = $("<button></button>",{
        text: "Run Program",
        click: function(){
            if (checkForNecessaryFiles()){
                SNP_TABLE_FILE = SNP_TABLE_FILE.split('\n');
                handleSNPReading(SNP_TABLE_FILE);
                handleTreeSelection(TREE_FILE);
                document.getElementById('modal-files').style.display = "none";
            }
            else
                alert("Missing required Files")
        },
        css: {
            float: "right",
            margin: 20,
        }
    });

    $("#files-list").append($("<br>"));
    let buttonReload = $("<input name = \"reload\" id= \"files-upload-modal\"  webkitdirectory directory multiple type= \"file\"/>");
    $("#files-list").append($("<label>Reload Folder</label>")).append(buttonReload);
    document.getElementById("files-upload-modal").onchange = function () {
        document.getElementById('modal-files').style.display = "none";
        getFiles("files-upload-modal")
    };
    $("#files-list").append(buttonStart);
}

/**
 * Checks if all necessary files have been uploaded.
 * @returns {boolean}
 */
function checkForNecessaryFiles(){
    return (TREE_FILE !== undefined && ID_FILE !== undefined && DATA_FILE !== undefined &&
            NON_DATA_FILE !== undefined &&  SNP_TABLE_FILE !== undefined)

}

/**
 * Creates list of files read.
 * It allows the user to check if the right files have been read.
 * @param {Array} files
 */
function createListOfFiles(files) {
    let filesNames = {"Newick": "T", "ID Distribution": "I", "Supporting SNPs":"D", "Non-Supporting SNPs":"N", "SNP Table":"TSV", "(opt) SNP Effect Table":"TSVE", "(opt) Nodes' Additional Information " :"AD", "(opt) GO-Description " :"GOA"};
    let keys = Object.keys(filesNames);
    for (let i = 0; i < keys.length; i++){
        let fileType = filesNames[keys[i]];
        let file = files.filter(file => file.readingType === fileType);
        let fileName;
        if (file.length === 0)
            fileName = "No file found.";
        else{
            fileName = file[file.length-1].name;
        }
        let fileList = $("#files-list");
        fileList.append($("<span></span>").text(keys[i] + " File: ").css({"font-weight":" bold", "margin":10, "margin-bottom":15}));
        if (file.length === 0)
            fileList.append($("<span></span>").text(fileName).css("color", "red"));
        else
            fileList.append($("<span></span>").text(fileName));
        fileList.append($("<input type=\"file\" id=\"FileUpload"+ fileType +"\">"));
        $("#FileUpload"+fileType).on("change", function(){reupload(fileType, files)}).css({"display":"none"});
        fileList.append($("<input type=\"button\" value=\"Reload file...\" onclick=\"document.getElementById(\'FileUpload"+fileType+"\').click();\" />").css({"margin-left":15}));
        fileList.append($("<br>"))
    }

}

/**
 * Allows the reuploading of a file.
 * @param {char} type - determines what kind of file is being uploaded.
 * @param {Array} files - Actual file list that will be expanded or replaced
 */
function reupload(type, files) {
    try {
        let file = $("#FileUpload"+type)[0].files;
        file = file[file.length-1];
        file.readingType = type;
        if (checkExtension(file)){
            handleFilesSelection(file);
            let filteredFile = files.filter( file => file.readingType === type);
            if (filteredFile.length === 0)
                files.push(file);
            else
                files[files.indexOf(filteredFile[filteredFile.length -1])] = file;
            showLoadedFiles(files)
        }
        else throw "Wrong file. Please check the extension."
    }
    catch (e) {
        alert(e)
    }


}

/**
 * Checks the format of the file given
 * @param {Object} file - File uploaded
 * @returns {boolean} - Is the format correct?
 */
function checkExtension(file){
    let valid = false;
    switch (file.readingType) {
        case "T":
            valid = validExtension(file.name, "nwk");
            break;
        case "TSVE":
            valid = validExtension(file.name, "tsv");
            break;
        case "TSV":
            valid = validExtension(file.name, "tsv");
            break;
        case "AD":
            valid = validExtension(file.name, "tsv");
            break;
        case "GOA":
            valid = validExtension(file.name, "tsv");
            break;
        default:
            valid = validExtension(file.name, "txt");
            break;
    }

    return valid;

}


/**
 * Depending on what kind of file is being uploaded, then it gets a reading type.
 * @param {Object} file
 */
function sortType(file) {
    let fileName = file.name;
    try{
        if (fileName.indexOf(".nwk") !== -1)
            file.readingType = "T";
        else if (fileName.indexOf("ID") !== -1 && fileName.indexOf(".txt") !== -1)
            file.readingType = "I";
        else if (fileName.indexOf("notSupportSplit") !== -1)
            file.readingType = "N";
        else if (fileName.indexOf("supportSplit") !== -1)
            file.readingType = "D";
        else if (fileName.indexOf("TableWithSnpEff") !== -1)
            file.readingType = "TSVE";
        else if (fileName.indexOf("snpTable") !== -1 || fileName.indexOf("snvTable") !== -1)
            file.readingType = "TSV";
        else if (fileName.indexOf("addinfo") !== -1)
            file.readingType = "AD";
        else if (fileName.indexOf("go_descriptions") !== -1)
            file.readingType = "GOA";
    }
    catch (e) {
        alert(e);
    }
}

/**
 * File Reader that calls the correct function depending on the file that has been uploaded.
 * @param {Object} file
 */
function handleFilesSelection(file) {
    try {
        const readType = file.readingType;
        let r = new FileReader();
        r.onload = function (e) {
            let contents = e.target.result;
            contents = contents.replace(new RegExp("\r", 'g'), "");
            switch (readType) {
                case 'T':
                    TREE_FILE = contents;
                    break;
                case 'I':
                    ID_FILE = contents;
                    break;
                case 'D':
                    DATA_FILE = contents;
                    break;
                case 'N':
                    NON_DATA_FILE = contents;
                    break;
                case 'AD':
                    ADD_DATA_FILE = contents;
                    break;
                case 'TSV':
                    SNP_TABLE_FILE = contents;
                    break;
                case 'TSVE':
                    SNP_EFFECT_FILE = contents;
                    break;
                case 'GOA':
                    handleGODetails(contents);
                    break;
            }
            NUM_FILES_LOADED++;
        };
        r.readAsText(file);
    }
    catch (e) {
        alert(e);
    }
}

/**
 * Resets all Files
 */
function resetFiles() {
    TREE_FILE = undefined;
    ID_FILE = undefined;
    DATA_FILE = undefined;
    NON_DATA_FILE = undefined;
    ADD_DATA_FILE = undefined;
    SNP_TABLE_FILE = undefined;
    SNP_EFFECT_FILE = undefined;

}
/**
 * Loads the tree.
 * @param str
 */
function handleTreeSelection(str) {
    try {
        resetSNPList();
        NUM_FILES_LOADED = 0;
        SNPid = START_SNP_ID;
        VISUALIZING = [];
        BINARY = [];
        STRINGS = {};
        RANGES = {};
        ADDITIONAL_INFO = {};
        ADDITIONAL_INFO_TYPES = {};
        tree.load(str);
        return true;
    }
    catch (e) {
        alert(e)
    }

}

/**
 * Reads the SNP table file in order to save which leaves contain which SNP.
 * @param {string} str - content of the SNP table file
 */
function handleSNPReading(str){
    let x = SNP_TABLE_FILE;
    let header = x[0].replace(new RegExp(" ", 'g'), "_").split("\t");
    for (let i = 1; i < x.length; i++) {
        let row = x[i].split("\t");
        SNP_TABLE_DICT[row[0]] = {};
        for (let j = 2; j < header.length ; j++){
            let base = (row[j] === "." )? row[1] : row[j];
            SNP_TABLE_DICT[row[0]][row[j]] === undefined ?  SNP_TABLE_DICT[row[0]][base] = [header[j]] : SNP_TABLE_DICT[row[0]][row[j]].push(header[j]);
        }
    }
}


/**
 * Distribution of the GO-description into a dictionary
 * @param {String} content
 */
function handleGODetails(content) {
    const x = content.split('\n');
    for (let i = 0; i < x.length; i++) {
        if (x[i].length > 0) {
            let y = x[i].split('\t');
            GOA[y[0]] = y[1];
        }
    }
}

/**
 * Distributes correctly the IDs given by the backend program.
 * @param {string} str - IDs of the Mapping File
 */
function handleIDSelection(str) {
    let IDMapping = {};
    const x = str.split('\n');
    for (let i = 0; i < x.length; i++) {
        if (x[i].length > 0) {
            let y = x[i].split('\t');
            IDMapping[y[1]] = y[0];
        }
    }
    distributeIds(IDMapping);
}

/**
 * Reads the file of the SNPs Effect.
 * Saves every SNP +Allele on a dictionary.
 * Alltogether are saved on an array.
 *
 * @param {String} str - content of the annotated SNP table
 * @returns {Array}
 */
function handleSNPEffectSelection(str) {
    // extractNumberOfSNPs();
    let SNPSEffects = [];
    let posAnnotImp, posAllele, posGOIDs;
    const x = str.split('\n');
    const header = x[0].split('\t');
    posAnnotImp = header.indexOf("Annotation_Impact");
    posAllele = header.indexOf("Allele");
    posGOIDs = header.indexOf("GO_IDs");
    SNP_EFFECT_TITLE = header.slice(posAllele);
    for (let i = 0; i < x.length; i++) {
        if (x[i].length>0) {
            let y = x[i].split('\t');
            if (y[posAnnotImp] !== "MODIFIER") {
                let SNP_Effect = {};
                SNP_Effect["Position"] = y[0];
                for (let j = posAllele; j < y.length; j++){
                    if (j === posGOIDs){
                        y[j] = y[j].replace(new RegExp("\"", 'g'), "");
                        SNP_Effect[header[j]] = y[j].split(";");
                    }

                    else
                        SNP_Effect[header[j]] = y[j]
                }
                SNPSEffects.push(SNP_Effect);
            }
        }
    }
    let allSNPS = extractAllSNPS();
    SNPSEffects = SNPSEffects.filter(snp => isFoundOnGroup(allSNPS, snp));
    return SNPSEffects;
}

/**
 * Recieves the content of a Additional Information file and distributes the values.
 * It also creates the respective types for the filtering.
 * @param {String} str - Content of the additional information file
 */
function handleAdditionalInfo(str) {
    let extractedInfo = readsAdditionalInfo(str);
    for (let i = 0; i < extractedInfo.length; i++) {
        distributeInformation(extractedInfo[i]);
    }
    distributeAdditionalInfo();
    createManyMultiselect(STRINGS, document.getElementById("multiple-select-string"));
    createMultiselect(BINARY, "Binary:", "binary", document.getElementById("multiple-select-binary"));
    createManyRanges(RANGES, document.getElementById("ranges"));
    $("<input type=\"button\" value=\"Filter\" onclick=\"extractFilterValues()\"> Nodes found: <span id=\"filteredNum\"> 0 </span>\n").appendTo("#extras-filtering");
    $("<a onclick=\"exportFilteredNodes()\"> Export to file...</a>\n").appendTo("#extras-filtering")

}

/**
 * Distribute the IDs with the given ID File.
 * Begin with the leaves, since the labels are the same, but repairs the ids.
 * Then, searches for the node, whose children are given by the String input.
 *
 * @param {String} IDMapping content of the ID label
 */
function distributeIds(IDMapping) {
    try {
        for (const leaf of tree.leaves) {
            leaf.id = IDMapping[leaf.label];
            delete IDMapping[leaf.label];
        }
        for (const [key, value] of Object.entries(IDMapping)) {
            if (key !== undefined && value !== undefined && !value.leaf) {
                const nodes = Object.values(tree.branches);
                const children = key.split(",");
                let node = nodes.filter(function (obj, index, nodes) {
                    return obj.id === children[0];
                });
                let parent_node = node[0].parent.id;
                tree.branches[parent_node].id = value;
                tree.branches[parent_node].label = key;
            }
        }
        repairBranches();
    }
    catch (e) {
        alert("Error while distributing the IDs");
    }
}

/**
 * Reads file of additional Information and distributes this into the respective array.
 *
 */
function distributeAdditionalInfo() {
    for (let key in ADDITIONAL_INFO) {
        const type = ADDITIONAL_INFO_TYPES[key];
        switch (type) {
            case 'BINARY':
                BINARY.push(key);
                break;
            case 'STRING':
                STRINGS[key] = ADDITIONAL_INFO[key];
                break;
            case 'DATE':
                RANGES[key] = transformToDate(ADDITIONAL_INFO[key]);
                break;
            case 'INT':
                RANGES[key] = transformToNumber(ADDITIONAL_INFO[key]);
                break;
            case 'FLOAT':
                RANGES[key] = transformToNumber(ADDITIONAL_INFO[key]);
                break;
        }
    }
    BINARY.sort();
    STRINGS = dictSort(STRINGS);
    RANGES = dictSort(RANGES);
}

/**
 * Distributes info from the dictionary to the respective node
 * @param dict
 */
function distributeInformation(dict) {
    let labelOfNode = dict.name;
    delete dict.name;
    let id = searchIdWithLabel(labelOfNode);
    const keysOfDict = Object.keys(dict);
    for (let i = 0; i < keysOfDict.length; i++) {
        let valueInDict = dict[keysOfDict[i]];
        if (ADDITIONAL_INFO[keysOfDict[i]] === undefined)
            ADDITIONAL_INFO[keysOfDict[i]] = [valueInDict];
        else if (ADDITIONAL_INFO[keysOfDict[i]].indexOf(dict[keysOfDict[i]]) === -1)
            ADDITIONAL_INFO[keysOfDict[i]].push(valueInDict);
    }
    if (id !== -1)
        tree.branches[id]['internalData']['additionalInfo'] = dict;
}



/**
 * Reads additional information.
 * By now, it only distributes it to an array.
 * It enables the faster interaction when doing a click.
 * @param {string} str - content of the Add. Information file
 */
function readsAdditionalInfo(str) {
    let additionalInfo = [];
    const x = str.split('\n');
    for (let i = 0; i < x.length; i++) {
        if (x[i].length > 0) {
            let y = x[i].split('\t');
            for (let j = 1; j < y.length; j++) {
                if (i === 0 && j > 1) {
                    additionalInfo.push({name: y[j].replace(new RegExp(" ", 'g'), "_")});
                }
                else if (j === 1) {
                    ADDITIONAL_INFO_TYPES[y[j]] = y[0];
                }
                else {
                    if (y[j] === "UNK")
                        y[j] = "";
                    else{
                        if (y[j].indexOf("\r") !== -1) {
                            y[j] = y[j].replace("\r", "");
                        }
                        if (ADDITIONAL_INFO_TYPES[y[j]] === "DATE") {
                            if (y[j] !== "UNK"){
                                y[j] = new Date(y[j]);
                                y[j] = y[j].toISOString().split("T")[0];
                            }
                        }
                        additionalInfo[j - 2][y[1]] = y[j];
                    }

                }

            }
        }
    }
    return additionalInfo;
}


/**
 * Distribute the SNP information to each node to the respective dictionary
 * @param str
 * @param type
 */
function handleSNPDataSelection(str, type) {
    try {
        const x = str.split('\n');
        for (let i = 0; i < x.length; i++) {
            let line = x[i];
            if (line.length > 0) {
                let [node, x, list] = line.split("\t");
                node = node.substr(node.indexOf(">") + 1);
                list = list.match(/([0-9]+:\[[ACGTN]\])/g);
                let SNPsOfNode = list.map(n => {
                    let [key, value] = n.split(':');
                    return {position: key, base: value[1]}
                });
                switch (type) {
                    case "D":
                        tree.branches[node]["internalData"]['SNPs'] = SNPsOfNode;
                        break;
                    case "N":
                        tree.branches[node]["internalData"]["nonSNPs"] = SNPsOfNode;
                        break;
                }
            }
        }
    }
    catch (e) {
        alert(e);
    }
}

/**
 * While the tree is loading,
 * it shows ceartain information.
 */
tree.on('loaded', function () {
    const upload = document.getElementById("collapseUpload");
    const uploadLink = document.getElementById("uploadLink");
    if (upload.getAttribute("class") === "panel-collapse collapse in") {
        uploadLink.click();
    }
    allNodes = tree.branches;
    const actualValue = tree.maxLabelLength.rectangular;
    saveMaxLabelLength.push(actualValue);
});

/**
 * When the canvas gets clicked,
 * it changes the information of the panels.
 *
 */
tree.on('click', function (e) {
    let node = tree.getNodeAtMousePosition(e);
    let subtrees;
    const divNumSubtrees = document.getElementById("subtreeNum");
    divNumSubtrees.innerText = 0;
    if (node) {
        subtrees = tree.getAllSubtreeRootIdsWithFlag("selected");
        divNumSubtrees.innerText = subtrees.join();
        changeNodeDetailInformation(node);
    }
});

/**
 * When the mouse moves over the canvas,
 * it gives the information of the supporting SNPs
 * It also gives the IDs.
 */
tree.on('mousemove', function (e) {
    const node = tree.getNodeAtMousePosition(e);
    let tooltip = tree.tooltip.element;
    const linebreak = document.createElement("br");
    if (node) {
        tooltip.innerHTML = "";
        tooltip.style.maxWidth = "30em";
        const textNode = document.createTextNode(node.label);
        tooltip.appendChild(textNode);
        const SNPsFromNode = node["internalData"]['SNPs'];
        tooltip.appendChild(linebreak);
        if (SNPsFromNode !== undefined) {
            appendSNPs(tooltip, SNPsFromNode, "D");
        }
        else {
            const textNonFound = document.createTextNode("No SNPs supporting this split");
            tooltip.appendChild(textNonFound);
        }
    }
});

/**
 * From a normal string, it transform the string to be suitable as a ID of an HTML element.
 * @param {String} str
 * @returns {string}
 */
function transformToHTMLID(str) {
    return str.toLowerCase().replace(new RegExp(" ", 'g'), "-");
}

/**
 * Handles an array of possible dates and transforms them into a standard Date format.
 *
 * @param arr
 * @returns {Array/error} Array of parsed dates/Error if the input format did not match the expected one
 */
function transformToDate(arr) {
    try {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === "UNK")
                arr[i] = new Date();
            else
                arr[i] = new Date(arr[i]);
                arr[i] = arr[i].toISOString().split("T")[0];
        }
        return arr;
    }
    catch (e) {
        alert(e+"\n \n Please make sure the date follows the format YYYY-MM-DD.")
    }
}

/**
 * Parses strings that are actually numbers into their correct format.
 * @param {Array} arr - Array of possible numbers
 * @returns {Array/error} - Array of parsed numbers / Error if format is wrong
 */
function transformToNumber(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = Number(arr[i]);
    }
    return arr;
}

/**
 * Changes a string in order to match the dictionary label that was used.
 * @param {string} str
 * @returns {string}
 */
function transformToDictID(str) {
    return toTitleCase(str.replace(new RegExp("-", 'g'), " "));
}

/**
 * Returns a string into title case (Only first letter in uppercase)
 * @param str
 * @returns {string | * | void}
 */
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

/**
 *
 * @param str
 * @returns {string | * | void}
 */
function transformToNormalText(str) {
    return str.replace(new RegExp("_", 'g'), " ");
}

/**
 *  Sorts a dictionary depending on the information it contains.
 * @param dict
 */
function dictSort(dict) {
    let sortedDict = {};
    for (let key in dict) {
        let typeToSort = typeof dict[key][0];
        switch (typeToSort.toString()) {
            case 'string':
                sortedDict[key] = dict[key].sort();
                break;
            case 'object':
                sortedDict[key] = dict[key].sort(function (a, b) {
                    return a - b
                });
                break;
            case 'number':
                sortedDict[key] = dict[key].sort(function (a, b) {
                    return a - b
                });
                break;
        }

    }
    return sortedDict;
}

/***
 * Becomes an array of subtrees` ids that need to be exported and returns a tsv string.
 * @param string
 * @param arr
 * @returns {*}
 */
function exportManySubtreeSambles(string, arr) {
    for (let i = 0; i < arr.length; i++) {
        string = exportSubtreeSamples(string, arr[i]);
    }
    return string
}

/**
 * exports the samples the labels of the subtree that is being exported.
 * @param string
 * @param id
 * @returns {string|*}
 */
function exportSubtreeSamples(string, id) {
    let node = tree.branches[id];
    string = string + "Subtree ID: \t" + id + "\r";
    if (node.leaf) {
        string = string + "Label: \t" + transformToNormalText(node.label) + "\r";
    }
    else {
        let leavesUnderSubtree = extractLeavesInSubtree(id);
        for (let i = 0; i < leavesUnderSubtree.length; i++) {
            let leaf = leavesUnderSubtree[i];
            string = string + "Label: \t" + transformToNormalText(leaf.label) + "\r";
        }
    }

    return string;
}

/**
 * Exports the given table.
 * @param tableID
 */
function exportTable(tableID) {
    try {
        let string = "";
        let table = document.getElementById(tableID);
        if (tableID.indexOf("common") !== -1) {
            let subtrees = document.getElementById("subtreeNum").innerText;
            string += "Subtrees: \t" + subtrees + "\r";
            let idArray = subtrees.split(",");
            string = exportManySubtreeSambles(string, idArray);
        }
        else {
            let node = document.getElementById("node-id").innerText;
            string = exportSubtreeSamples(string, node);

        }
        let rows = table.rows;
        if (rows.length === 0) throw "Nothing on table";
        for (let i = 0; i < rows.length; i++) {
            let cells = rows[i].cells;
            if (cells.length === 0) throw "Nothing on table";
            for (let j = 0; j < cells.length; j++)
                string = string + cells[j].innerText + "\t";
            string = string + "\r";
        }
        download(string, tableID, "text/tsv");
    }
    catch (e) {
        console.log(e)
    }
}


/**
 * Extracts the filters used and writes them on a string.
 *
 * @param obj
 * @returns {string}
 */
function writeUsedFilters(obj) {
    let stringOfFilters = "Selected Filters \n";
    for (let key in obj) {
        let subobj = obj[key];
        switch (key) {
            case "Binaries":
                if (subobj.length > 0) {
                    stringOfFilters += "Binaries \t";
                    for (let i in subobj)
                        stringOfFilters += subobj[i] + "\t";
                    stringOfFilters += "\n";
                }
                break;
            case "Strings":
                for (let subkey in subobj) {
                    if (subobj[subkey].length > 0) {
                        stringOfFilters += subkey + "\t";
                        for (let i in subobj[subkey])
                            stringOfFilters += subobj[subkey][i] + "\t";
                        stringOfFilters += "\n";
                    }
                }
                break;
            case "Ranges":
                for (let subkey in subobj) {
                    if (subobj[subkey].length > 0) {
                        stringOfFilters += subkey + "\t";
                        for (let i in subobj[subkey])
                            stringOfFilters += subobj[subkey][i][0] + "_to_" + subobj[subkey][i][1] + "\t";
                        stringOfFilters += "\n";
                    }
                }
        }
    }
    return stringOfFilters;
}

/**
 * Returns a tsv file of the SNP table with only the nodes
 * that fulfill the given conditions conditions.
 * @param arr
 * @returns {string}
 */
function sortCollapsedOut(arr) {
    let newCopy = "";
    const x = SNP_TABLE_FILE;
    let usefullIndices = [];
    for (let i = 0; i < x.length; i++) {
        if (x[i].length > 0) {
            let y = x[i].split('\t');
            for (let j = 0; j < y.length; j++) {
                if (j < 2)
                    newCopy = newCopy + y[j] + "\t";
                else if (i === 0) {
                    if (arr.indexOf(y[j]) !== -1) {
                        usefullIndices.push(j);
                        newCopy = newCopy + y[j] + "\t";
                    }
                }
                else if (usefullIndices.indexOf(j) !== -1)
                    newCopy = newCopy + y[j] + "\t";
            }
            newCopy = newCopy + "\r";
        }
    }
    return newCopy
}

/**
 * Exports the SNP table file with only the filtered samples and with the filters used.
 */
function exportFilteredNodes() {
    let notCollapsed = tree.getNodeIdsWithFlag("collapsed", false);
    let notCollapsedLabels = [];
    let usedFilters = writeUsedFilters(tree.FILTERS);
    for (let i = 0; i < notCollapsed.length; i++)
        notCollapsedLabels.push(transformToNormalText(tree.branches[notCollapsed[i]].label));
    let onlyFiltered = sortCollapsedOut(notCollapsedLabels);
    let string = usedFilters + "\n" + onlyFiltered;
    download(string, "filtered", "text/tsv");
}

/**
 * downloads the file
 * @param data
 * @param filename
 * @param type
 */
function download(data, filename, type) {
    let file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        let a = document.createElement("a"),
            url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename + ".tsv";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}


/**
 * Verifies if the name given ends with the expected extension.
 * @param name
 * @param ext
 * @returns {boolean}
 */
function validExtension(name, ext) {
    return ext === name.substr(-3);
}

/**
 * Repairs tree after drawing a subtree and then redrawing the original tree.
 * Called in the Library at line 1486.
 */
function repairOriginalTree() {
    repairMetadataView();
    tree.maxLabelLength = {rectangular: saveMaxLabelLength[0]};
    tree.draw();
}

/**
 * Reads all active SNPs and updates the view.
 */
function repairMetadataView() {
    const ul = document.getElementById("listSNP");
    const visualizedSNPs = ul.getElementsByTagName("li");
    if (visualizedSNPs.length !== 0) {
        for (let i = 0; i < visualizedSNPs.length; i++) {
            let text = visualizedSNPs[i].innerHTML;
            let istart = text.indexOf(":");
            const labelOfData = text.substr(0, istart);
            let result = text.substr(istart + 2);
            let iend = result.indexOf("<");
            const inputSNP = result.substr(0, iend);
            let nodesFound = (searchInNodes("D", inputSNP)).concat((searchInNodes("N", inputSNP)));
            addDataIntoNodes(nodesFound, inputSNP, labelOfData);
            SNPid++;
        }
    }
}

/**
 * The whole structure needs to be updated since the keys
 * are still the old ones.
 */
function repairBranches() {
    for (const [key, value] of Object.entries(tree.branches)) {
        tree.branches[value.id] = value;
        tree.branches[value.id]["internalData"] = [];
        delete tree.branches[key];
    }
}


/*****************************************************************************************************
 * *****************                 NODES AND SNPs          ****************************************
 ****************************************************************************************************/
/**
 * Given an Id of a subtree, the leaves within this tree are extracted.
 * @param {int} id
 * @returns {Array} Array of Objects
 */
function extractLeavesInSubtree(id) {
    let leavesFound = [];
    let subroot = tree.branches[id];
    let children = subroot.children;

    for (let i = 0; i < children.length; i++) {
        let node = children[i];
        if (node.leaf)
            leavesFound.push(node);
        else
            leavesFound = leavesFound.concat(extractLeavesInSubtree(node.id));
    }
    return leavesFound;

}

/**
 * Appends information to the given tooltype.
 * It was possible to apend both kinds of SNPs,
 * but the non-supporting were found useless.
 * @param {Object} tooltip
 * @param {Object} data
 * @param {char} type
 */
function appendSNPs(tooltip, data, type) {
    let textTypeSNP;
    switch (type) {
        case "D":
            textTypeSNP = document.createTextNode("supporting SNPs: ");
            break;
        case "N":
            textTypeSNP = document.createTextNode("non-supporting SNPs: ");
            break;
    }
    tooltip.appendChild(textTypeSNP);
    tooltip.appendChild(document.createElement("br"));
    for (let i = 0; i < data.length; i++) {
        const SNPText = document.createTextNode(data[i]['position'] + ": " + data[i]['base'] + "  ");
        tooltip.appendChild(SNPText);
    }
}

/**
 * Parses the searched label of a leaf and searches for it.
 *
 */
function selectLabel() {
    let x = document.getElementById("modleaf").value;
    const allNodes = Object.entries(tree.branches);
    let subtrees;
    const divNumSubtrees = document.getElementById("subtreeNum");
    let node = allNodes.find(P => P[1].label === x);
    node = node[1];
    if (typeof node !== 'undefined') {
        tree.branches[node.id].selected = !tree.branches[node.id].selected;
        subtrees = tree.getAllSubtreeRootIdsWithFlag("selected");
        divNumSubtrees.innerText = subtrees.join();
        changeNodeDetailInformation(node);
        tree.draw();
    }
    else
        alert("No node found with label " + x);
}

/**
 * Same as above, but with id's.
 * If the node is an intNode then, cascades the selection.
 */
function selectID() {
    let x = document.getElementById("selectID").value;
    let node = tree.branches[x];
    if (typeof node !== 'undefined') {
        selectNodeWithID(node.id)
    }
    else
        alert("No node found with ID " + x);
}

/**
 * Selects the given subtree/node with the ID given.
 * It also updates the inforamtion of the panels.
 * @param id
 */
function selectNodeWithID(id){
    Object.values(tree.branches).forEach(branch => branch.selected = false);
    let subtrees;
    const divNumSubtrees = document.getElementById("subtreeNum");
    tree.branches[id].selected = !tree.branches[id].selected;
    tree.branches[id].cascadeFlag("selected", true);
    subtrees = tree.getAllSubtreeRootIdsWithFlag("selected");
    divNumSubtrees.innerText = subtrees.join();
    changeNodeDetailInformation(tree.branches[id]);
    tree.draw();
}

/**
 * Given a label, it returns the ID of the node.
 * @param label
 * @returns {int} ID of the Node or -1
 */
function searchIdWithLabel(label) {
    if (label.indexOf("\r") !== -1) {
        label = label.replace("\r", "");
    }
    let leaves = tree.leaves;
    let node = leaves.find(l => l.label === label);
    if (node !== undefined)
        return node.id;
    else
        return -1; // No node found with that label.
}

/**
 * Says if the subtree roots given are in a clade
 * @param arrayOfSubtrees
 * @param LCA - optional
 * @returns {boolean}
 */
function isAClade(arrayOfSubtrees, LCA) {
    if (LCA === undefined)
        LCA = findLCAofNodes(arrayOfSubtrees);
    let subNodesOfLCA = LCA.children.slice();
    while (subNodesOfLCA.length > 0) {
        let node = subNodesOfLCA.shift();
        if (arrayOfSubtrees.findIndex(ID => ID === node.id.toString()) === -1) {
            if (node.leaf) {
                return false
            }
            let savedChildren = node.children;
            subNodesOfLCA = savedChildren.concat(subNodesOfLCA);
        }
    }
    return true;
}

/**
 * Given some roots of subtrees, it extracts the IDs of all nodes in the subtrees.
 * @param {Array} array of IDs of nodes
 * @returns {Array} Array of IDs - From the nodes within the subtrees given.
 */
function extractNodesInSubtrees(array) {
    let nodes = extractNodesInSubtree(tree.branches[array[0]]);
    for (let i = 1; i < array.length; i++) {
        nodes = nodes.concat(extractNodesInSubtree(tree.branches[array[i]]));
    }
    return nodes
}

/**
 * returns all nodes IDs in the given subtree, including its root
 * @param {Object} node - Root of the subtree
 * @returns {Array} Arryay of IDs
 */
function extractNodesInSubtree(node) {
    let nodesInSubtree = [];
    nodesInSubtree.push(node.id);
    if (!node.leaf) {
        for (let j = 0; j < node.children.length; j++)
            nodesInSubtree = nodesInSubtree.concat(arguments.callee(node.children[j]));
    }
    return nodesInSubtree
}

/**
 * Given a Ancestor of a node, collects the nodes between those two.
 * It does not include the extreme nodes
 * @param lower
 * @param upper
 * @returns {Array} Array of IDs
 */
function nodesInPath(lower, upper) {
    let nodesInbetween = [];
    let parent = lower.parent;
    while (parent !== upper) {
        nodesInbetween.push(parent.id);
        parent = parent.parent;
    }
    return nodesInbetween;
}

/**
 * @param n1
 * @param n2
 * @returns {Branch|*} LCA
 */
function findLCA(n1, n2) {
    let node1, node2;
    node1 = tree.branches[n1];
    node2 = tree.branches[n2];
    while (node1 !== node2) {
        if (extractNodesInSubtree(node1).indexOf(node2.id) !== -1)
            node2 = node2.parent;
        else if (extractNodesInSubtree(node2).indexOf(node1.id) !== -1)
            node1 = node1.parent;
        else {
            node1 = node1.parent;
            node2 = node2.parent;
        }
    }
    return node1;
}

/**
 * fincds the LCA object of an array of nodes.
 * @param array
 * @returns {Object} LCA
 */
function findLCAofNodes(array) {
    let LCA = findLCA(array[0], array[1]);
    for (let i = 2; i < array.length; i++)
        LCA = findLCA(LCA.id, array[i]);
    return LCA
}

/**
 * Returns if the Set in question is a Subset of the other one.
 * @param {array} inQuestion
 * @param {Array} set
 * @returns {boolean}
 */
function isSubset(inQuestion, set) {
    let result = inQuestion.find(P => set.indexOf(P) === -1);
    return result === undefined;
}

/**
 * Sorts a SNP array depending on the position of the SNP.
 * @param unsorted
 * @returns {Array}
 */

function sort(unsorted) {
    let tempsorted = [];
    let sorted = [];
    for (let key in unsorted) {
        if (unsorted[key] !== undefined) {
            let pos = unsorted[key].position;
            pos = Number(pos);
            tempsorted[tempsorted.length] = pos;
        }
    }
    tempsorted.sort((a, b) => a - b);
    for (let i = 0; i < tempsorted.length; i++) {
        let index = unsorted.findIndex(P => P.position === tempsorted[i].toString());
        sorted[sorted.length] = unsorted[index];
        unsorted[index] = {position: -1, base: "X"}; //If not used, the sorting algorithm will pick the same item twice
    }
    return sorted;
}


/**
 * @param array
 * @returns {Array} - same array without duplicates
 */
function deleteDuplicatesOfSNPs(array) {
    let noDup = [];
    for (let i = 0; i < array.length; i++) {
        if (noDup.findIndex(j => j.position === array[i].position && j.base === array[i].base) === -1)
            noDup.push(array[i]);
    }
    return noDup
}

/**
 *
 * @param array1
 * @param array2
 * @returns {Array} Elements that appear in both arrays
 */
function extractIntersection(array1, array2) {
    let intersection = [];
    for (let i = 0; i < array1.length; i++) {
        if (array2.findIndex(j => j.position === array1[i].position && j.base === array1[i].base) !== -1)
            intersection.push(array1[i]);
    }
    return intersection;
}


/**
 * Searches for a SNP at given Database and position with a possible base.
 * If no base is given, then looks every SNP at that position.
 * @param {char} type - Supporting (D)/NonSupp (N)?
 * @param {int} SNP - Postion of the SNP
 * @param {char} base - Allele of the SNP
 * @returns {Array}
 */
function searchInNodes(type, SNP, base) {
    let nodesFound = [];
    let lookingFor;
    switch (type) {
        case "D":
            lookingFor = "SNPs";
            break;
        case "N":
            lookingFor = "nonSNPs";
            break;
    }
    let text = SNP;
    for (const [key, value] of Object.entries(tree.branches)) {
        let SNPs = value['internalData'][lookingFor];
        if (typeof SNPs !== 'undefined') {
            let foundSNP;
            if (typeof base !== "undefined")
                foundSNP = SNPs.find(P => P.position === text && P.base === base);
            else
                foundSNP = SNPs.find(P => P.position === text);
            if (typeof foundSNP !== 'undefined')
                nodesFound.push(key);
        }
    }
    return nodesFound;
}


/**
 * Becomes an Array of all Nodes that have a SNP in common and the position of the SNP.
 * Changes all of the leaves to the respective Color depending on the base
 * The rest is transparent, otherwise data would be overwritten.
 * @param foundNodes
 * @param SNP
 * @param labelOfData
 */
function addDataIntoNodes(foundNodes, SNP, labelOfData) {
    let allnodes = tree.branches;
    for (const [key, value] of Object.entries(allnodes)) {
        value.colour = "black";
        let foundSNP, base, color;
        if (foundNodes.indexOf(key) !== -1) {
            let SNPsOfNode = allnodes[key]['internalData']['SNPs'];
            let nonSNPsOfNode = allnodes[key]["internalData"]["nonSNPs"];
            if (nonSNPsOfNode !== undefined) {
                foundSNP = nonSNPsOfNode.find(P => P.position === SNP);
                if (foundSNP !== undefined) {
                    base = foundSNP['base'];
                    color = "black";
                }
                else {
                    foundSNP = SNPsOfNode.find(P => P.position === SNP);
                    base = foundSNP['base'];
                    color = colourBase(base);
                }
            }
            else {
                foundSNP = SNPsOfNode.find(P => P.position === SNP);
                base = foundSNP['base'];
                color = colourBase(base);
            }
            allnodes[key].colour = color;
            let newData = {colour: color, label: base,};
            if (allnodes[key].leaf)
                allnodes[key].data[labelOfData] = newData;
            else
                inheritData(allnodes[key], newData, labelOfData);
        }
        else
            value.data[labelOfData] = {colour: "transparent"};
    }
    tree.draw();
    //The redraw causes the centering of the tree.
    // if not used, the metadata columns do not update.
    tree.root.redrawTreeFromBranch();
}


/**
 * Returns the respective color for the given base.
 * @param base
 * @returns {string} respective color
 */
function colourBase(base) {
    switch (base) {
        case 'A':
            return 'blue';
        case 'C':
            return 'green';
        case 'G':
            return 'red';
        case 'T':
            return 'orange';
        case 'N':
            return 'purple';
        default:
            return 'black';
    }
}

/**
 * Changes the information of the leaves.
 *
 * Since the data iterates from leaves to root, then we can always test if the leaf
 * already has a color, then do not change it.
 *
 * @param {Branch} node - actual node
 * @param {Object} data - data that has been given to be changed
 * @param {String} label - name of the data that has been created.
 */
function inheritData(node, data, label) {
    node.colour = "darkblue";
    if (node.leaf) {
        if (node.data[label]['colour'] === "transparent" || node.data[label]['colour'] === undefined)
            node.data[label] = data;
    }
    else {
        for (let j = 0; j < node.children.length; j++)
            arguments.callee(node.children[j], data, label);
    }
}

/**
 * Inherits color for the leaves from the parent nodes
 * @param node
 * @param data
 */
function inheritColor(node, data) {
    node.colour = "darkblue";
    if (node.leaf) {
        node.colour = data;
    }
    else {
        node.colour = data;
        for (let j = 0; j < node.children.length; j++)
            arguments.callee(node.children[j], data);
    }
}

/**
 * From an array of Nodes, extracts the SNPs of the given Database.
 * @param {Array} arrayNodes
 * @param {char} type
 * @returns {Array}
 */
function extractSNPsFromNodes(arrayNodes, type) {
    let SNPsextracted = [];
    let lookingFor;
    switch (type) {
        case "D":
            lookingFor = "SNPs";
            break;
        case "N":
            lookingFor = "nonSNPs";
            break;
    }
    for (let i = 0; i < arrayNodes.length; i++) {
        let keyOfNode = arrayNodes[i];
        const SNPsOfNode = tree.branches[keyOfNode]["internalData"][lookingFor];
        if (SNPsOfNode !== undefined)
            SNPsextracted = SNPsextracted.concat(SNPsOfNode);
    }
    SNPsextracted = sort(SNPsextracted);
    return SNPsextracted;

}

/**
 *  * Extracts SNPs from the nodes given and decides if they are unique for the subtree or not.
 * @param {Array} subtreeNodes
 * @param {char} type (D/N)
 *
 * @returns {Array}
 */
function uniqueSNPInSubtree(subtreeNodes, type) {
    const SNPsSubtree = extractSNPsFromNodes(subtreeNodes, type);
    let uniqSNP = onlyUniquesInSubtree(subtreeNodes, SNPsSubtree, type);
    uniqSNP = sort(uniqSNP);
    return uniqSNP;
}

/**
 * Returns an array of SNPs that are unique in the Substree.
 *
 * @param {Array} arrayNodesInSubtree - nodes that are in the Subtree
 * @param {Array} SNPsInSubtree - SNPs present in the Subtree
 * @param {char} type - if supporting "D", if not "N"
 * @returns {Array}
 */
function onlyUniquesInSubtree(arrayNodesInSubtree, SNPsInSubtree, type) {
    let uniqueSNPs = [];
    for (let i = 0; i < SNPsInSubtree.length; i++) {
        const SNP = SNPsInSubtree[i];
        let pos = SNP.position;
        let base = SNP.base;
        let containingNodes = searchInNodes(type, pos, base);
        if (isSubset(containingNodes, arrayNodesInSubtree) && containingNodes.length !== 0) {
            if (uniqueSNPs.findIndex(i => i.position === pos && i.base === base) === -1)
                uniqueSNPs.push(SNP);
        }
    }
    return uniqueSNPs;
}



/****************************************************************************************************************
 ******************FILTERING************************************************************************************
 ***************************************************************************************************************/
/**
 * Used for the tooltip of the ranges
 *
 * @param value
 * @returns {string}
 */
function translateValueOfRange(value) {
    let idOfObj = this.id.substr(0, this.id.length - 2);
    idOfObj = transformToDictID(idOfObj);
    let stringConverted = value.toString();
    let edges = stringConverted.split(",");
    let min = RANGES[idOfObj][edges[0]];
    let max = RANGES[idOfObj][edges[1]];
    return min + " : " + max;
}

/**
 * Extracts selected values for the filtering.
 * If the node doesn't fulfill the conditions, then it gets collapsed.
 */
function extractFilterValues() {
    expandAll(tree);
    tree.FILTERS = {};
    let feedbackFilter = document.getElementById("filteredNum");
    let selectedBinaries = $('#binary').multipleSelect('getSelects');
    tree.FILTERS["Binaries"] = selectedBinaries;
    let stringContainer = document.getElementById("multiple-select-string");
    let selectedStrings = extractSelectedMultiselect(stringContainer);
    tree.FILTERS["Strings"] = selectedStrings;
    let rangeContainer = document.getElementById("ranges");
    let selectedRanges = extractSelectedRanges(rangeContainer);
    tree.FILTERS["Ranges"] = selectedRanges;
    let nodesFound = tree.leaves.length;
    for (let i = 0; i < tree.leaves.length; i++) {
        let actualLeaf = tree.leaves[i].internalData.additionalInfo;
        let trueForAllBinaries = true;
        let inAllStrings = true;
        let inAllRanges = true;
        if (selectedBinaries.length !== 0)
            trueForAllBinaries = checkTautology(actualLeaf, selectedBinaries);
        for (let key in selectedStrings) {
            if (selectedStrings[key].length !== 0 && selectedStrings[key].indexOf(actualLeaf[key]) === -1) {
                inAllStrings = false;
                break;
            }
        }
        for (let key in selectedRanges) {
            if (selectedRanges[key].length !== 0 && !isInRange(selectedRanges[key], actualLeaf[key]))
                inAllRanges = false;
        }
        if (!inAllRanges || !inAllStrings || !trueForAllBinaries) {
            tree.leaves[i].collapse();
            nodesFound--;
        }
        else
            tree.leaves[i].selected = 1;
    }
    feedbackFilter.innerHTML = nodesFound;
    tree.draw();

}

/**
 * extracts the values of all the multiselect box in the div given
 * @param {Object} container
 */
function extractSelectedMultiselect(container) {
    let selectedString = {};
    let multiselects = $("#" + container.id + " > select");
    for (let i = 0; i < multiselects.length; i++) {
        let itemID = multiselects[i].id;
        let selectedInItem = $("#" + itemID).multipleSelect('getSelects');
        if (multiselects[i].id.indexOf("place") !== -1)
            selectedInItem = toAlpha3(selectedInItem);
        selectedString[transformToDictID(itemID)] = selectedInItem;
    }
    return selectedString
}

/**
 * Extract all the selected values from the ranges in the container
 * @param {Object} container
 */
function extractSelectedRanges(container) {
    let selectedRanges = {};
    let ranges = $("#" + container.id + " > div");
    for (let i = 0; i < ranges.length; i++) {
        let divID = ranges[i].id;
        let dictID = transformToDictID(divID.substring(0, divID.indexOf("-container")));
        selectedRanges[dictID] = extractRangesInDiv(divID);
    }
    return selectedRanges;
}

/**
 * from the ranges, extracts more values, if more ranges have been added.
 * @param {string} containerID
 * @returns {Array}
 */
function extractRangesInDiv(containerID) {
    let selectedValues = [];
    let childrenOfDate = $("#" + containerID + " > input:text").length;
    let childrenID = containerID.substring(0, containerID.indexOf("-container"));
    for (let i = 1; i < childrenOfDate + 1; i++) {
        const minSelectedValue = RANGES[transformToDictID(childrenID)][$("#" + childrenID + i).slider("getValue")[0]];
        const maxSelectedValue = RANGES[transformToDictID(childrenID)][$("#" + childrenID + i).slider("getValue")[1]];
        selectedValues.push([minSelectedValue, maxSelectedValue]);
    }
    return selectedValues;
}

/**
 * is the value within the ranges given?
 * @param {Array} array - Array of two values
 * @param {int} value
 * @returns {boolean}
 */
function isInRange(array, value) {
    if (array.length === 0)
        return true;
    else {
        for (let i = 0; i < array.length; i++) {
            if (value >= array[i][0] && value <= array[i][1])
                return true;
        }
        return false
    }
}

/**
 * Recieves the additional information of a node and an array of binary Parameter.
 * Returns if this array is true for all parameters.
 * @param node
 * @param binaries
 * @returns {boolean}
 */
function checkTautology(node, binaries) {
    let result = true;
    for (let i = 0; i < binaries.length; i++) {
        let node_value = Number(node[binaries[i]]);
        result = result && Boolean(node_value);
        if (!result)
            return result;
    }
    return result;
}

/****************************************************************************************************************
 ******************STATISTICS************************************************************************************
 ***************************************************************************************************************/
/**
 * Runs the analytics on a given branch for the information on the nodes.
 * @param branch
 */
function runAnalyticsOnNodes(branch) {

    selectNodeWithID(branch.id);
    let leavesOfSubtree = extractLeavesInSubtree(branch.id);
    let additionalDataLoaded = (ADD_DATA_FILE !== undefined);
    $("#title-statistics").text("Enrichment Analysis on Nodes' Information");
    prepareModal(branch);
    if (additionalDataLoaded) {
        let possibleAnalytics = (Object.keys(STRINGS));
        possibleAnalytics.push("Binary");
        createMultiselect(possibleAnalytics, "Characteristic", "characteristic-to-analyze", document.getElementById('content'), {single: true});
        let enrichmentcbutton = $('<button/>', {
            id: "enrichment-analysis",
            text: 'Enrichment',
            click: function () {
                if ($("#characteristic-to-analyze").multipleSelect("getSelects").length !== 0)
                    enrichmentAnalysis(leavesOfSubtree);
                else
                    alert("No characteristic selected.")
            }
        });
        $('#content').append(enrichmentcbutton);

    }
    else
        $('#content').text("This option is only available when an additional data file has been uploaded.");
    addBottomModal();
}

/**
 * Run analtytics on the subtree, but only with the SNPs
 * @param branch
 */
function runAnalyticsOfSnps(branch){
    selectNodeWithID(branch.id);
    let nodesinSubtree = extractNodesInSubtrees([branch.id]);
    let SuppSNPSinSubtree = extractSNPsFromNodes(nodesinSubtree, "D");
    let nonSuppSNPSinSubtree = extractSNPsFromNodes(nodesinSubtree, "N");
    let allSNPSinSubtree = SuppSNPSinSubtree.concat(nonSuppSNPSinSubtree);
    const lenghtAllSNPsinSubtree = deleteDuplicatesOfSNPs(allSNPSinSubtree).length;
    let DataLoaded = (SNP_EFFECT_FILE !== undefined);
    prepareModal(branch);
    $("#title-statistics").text("Enrichment Analysis on SNPs");
    if (DataLoaded) {
        let allSNPSinSubtreeFullNotated = SNPS_EFFECTS.filter(snp => isFoundOnGroup(allSNPSinSubtree, snp));
        createMultiselect(SNP_EFFECT_TITLE, "SNP Characteristic", "snp-characteristic-to-analyze", document.getElementById("content"), {single: true});
        let enrichmentcbutton = $('<button/>', {
            id: "enrichment-analysis",
            text: 'Enrichment',
            click: function () {
                if ($("#snp-characteristic-to-analyze").multipleSelect("getSelects").length !== 0)
                    enrichmentAnalysisOnSNPS(allSNPSinSubtreeFullNotated, lenghtAllSNPsinSubtree, branch);
                else
                    alert("No characteristic selected.")
            }
        });
        $('#content').append(enrichmentcbutton);
    }
    else
        $('#content').text("This option is only available when a SNP effect data file has been uploaded.");
    addBottomModal()
}

/***
 * Given a group of SNPs, is the snp given inside?
 * @param SNPs
 * @param snp
 * @returns {boolean}
 */
function isFoundOnGroup(SNPs, snp){
    return (SNPs.findIndex(snp1 => snp1.position === snp.Position && snp1.base === snp.Allele) !== -1)
}
/**
 * Counts the values for the FET.
 * Does the enrichment information for the selected characteristic.
 * @param subtreeLeaves
 */
function enrichmentAnalysis(subtreeLeaves) {
    const modalText = document.getElementById("text-in-modal");
    const levelSig = $('#significance-values').multipleSelect('getSelects');
    const selectedCharacteristic = $('#characteristic-to-analyze').multipleSelect('getSelects')[0];
    const significanceTable = document.getElementById("significance-table");
    let arrayCharacteristicInSubtree = [];
    if (selectedCharacteristic === "Binary"){
        arrayCharacteristicInSubtree = BINARY;
    } else {
        for (let i = 0; i < subtreeLeaves.length; i++) {
            let value = subtreeLeaves[i].internalData.additionalInfo[selectedCharacteristic];
            if (arrayCharacteristicInSubtree.indexOf(value) === -1 || arrayCharacteristicInSubtree.length === 0)
                arrayCharacteristicInSubtree.push(value);
        }
    }
    arrayCharacteristicInSubtree.sort();
    const comparisonNumber = arrayCharacteristicInSubtree.length;
    const correctedLevel = new Decimal(levelSig/comparisonNumber);
    resetContainer(significanceTable);
    modalText.innerText = "";
    setTimeout(showLoader(), 1);
    let correctedLevelText = $('<span></span>', {
        id: "correctedLevel",
        text: "corrected signifcance level: " + correctedLevel.toDP(6,4),
        style: "font-weight: Bold"
    });
    modalText.innerText = modalText.innerText + "\n" + "Significance Level: \t" + levelSig+ "\n" + "The following p-values have been corrected.";
    modalText.innerText = modalText.innerText + "\n" + "Fischer's Exact Test runned as logarithms.";
    modalText.innerText = modalText.innerText + "\n" + "Comparisons made: " + comparisonNumber + ", ";
    $("#text-in-modal").append(correctedLevelText);
    setTimeout(1);
    let j = 0;
    function updateRow() {
        let value = arrayCharacteristicInSubtree[j];
        updateSignificanceRow(subtreeLeaves, value, correctedLevel, significanceTable, selectedCharacteristic);
        j++;
        if(j < comparisonNumber){
            setTimeout(updateRow,1);
        }
        else
            document.getElementById("loader").style.display = "none";
    }
    setTimeout(updateRow,1);

}

/**
 * Starts the enrichment analysis for the SNPs given
 * @param AnnotatedSNPsonSubtrees
 */
function enrichmentAnalysisOnSNPS(AnnotatedSNPsonSubtrees, lengthOfAllSNPs, branch) {
    const modalText = document.getElementById("text-in-modal");
    const levelSig = $('#significance-values').multipleSelect('getSelects');
    const selectedCharacteristic = $('#snp-characteristic-to-analyze').multipleSelect('getSelects')[0];
    const significanceTable = document.getElementById("significance-table");
    let arrayCharacteristicInSubtree = [];
    for (let i = 0; i < AnnotatedSNPsonSubtrees.length; i++) {
        let value = AnnotatedSNPsonSubtrees[i][selectedCharacteristic];
        if (selectedCharacteristic.indexOf("GO") !== -1 && !value.every(val => arrayCharacteristicInSubtree.includes(val)))
            arrayCharacteristicInSubtree = arrayCharacteristicInSubtree.concat(value);
        else if (selectedCharacteristic.indexOf("GO") === -1 && arrayCharacteristicInSubtree.indexOf(value) === -1 || arrayCharacteristicInSubtree.length === 0)
            arrayCharacteristicInSubtree.push(value);
    }
    if (selectedCharacteristic.indexOf("GO_IDs") !== -1)
        arrayCharacteristicInSubtree = arrayCharacteristicInSubtree.filter(function (item, pos) {return arrayCharacteristicInSubtree.indexOf(item) === pos});
    arrayCharacteristicInSubtree.sort();
    arrayCharacteristicInSubtree = arrayCharacteristicInSubtree.filter(char => char !== undefined && char.length !== 0);
    resetContainer(significanceTable);
    modalText.innerText = "";
    if (arrayCharacteristicInSubtree.length === 0)
        modalText.innerText = "No characteristic found.";
    else
    {
        const comparisonNumber = arrayCharacteristicInSubtree.length;
        const correctedLevel = new Decimal(levelSig/comparisonNumber);
        setTimeout(showLoader(), 1);
        let correctedLevelText = $('<span></span>', {
            id: "correctedLevel",
            text: "corrected signifcance level: " + correctedLevel.toDP(6,4),
            style: "font-weight: Bold"
        });
        modalText.innerText = modalText.innerText + "\n" + "Significance Level: \t" + levelSig+ "\n" + "The following p-values have been corrected.";
        modalText.innerText = modalText.innerText + "\n" + "Fischer's Exact Test runned as logarithms.";
        modalText.innerText = modalText.innerText + "\n" + "Comparisons made: " + comparisonNumber + ", ";
        $("#text-in-modal").append(correctedLevelText);
        setTimeout(1);
        let j = 0;
        function updateRow2() {
            let value = arrayCharacteristicInSubtree[j];
            updateSignificanceRowForSNPS( AnnotatedSNPsonSubtrees, value, correctedLevel, significanceTable, selectedCharacteristic, lengthOfAllSNPs, branch);
            j++;
            if(j < comparisonNumber){
                setTimeout(updateRow2,1);
            }
            else
                document.getElementById("loader").style.display = "none";
        }
        setTimeout(updateRow2,1);
    }
}

/**
 * Updates a row for the significant table with the values of the node information.
 * @param subtreeLeaves
 * @param characteristic
 * @param significantLevel
 * @param table
 * @param selectedChar
 */
function updateSignificanceRow(subtreeLeaves, characteristic, significantLevel,table, selectedChar){
    const row = document.createElement("tr");
    table.appendChild(row);
    const cell = document.createElement("td");
    if (selectedChar.indexOf("Place") !== -1)
        cell.appendChild(document.createTextNode(whereAlpha3(characteristic).country));
    else
        cell.appendChild(document.createTextNode(characteristic));
    const cellpvalue = document.createElement("td");
    const cellsignificant = document.createElement("td");
    let a = 0, b = 0, c = 0, d = 0;
    let haveCharacteristic;
    if (selectedChar === "Binary")
        haveCharacteristic = tree.leaves.filter(leaf => leaf.internalData.additionalInfo[characteristic] === "1");
    else
        haveCharacteristic = tree.leaves.filter(leaf => leaf.internalData.additionalInfo[selectedChar] === characteristic);
    b = haveCharacteristic.filter(leaf => subtreeLeaves.indexOf(leaf) !== -1).length;
    d = haveCharacteristic.length - b;
    a = subtreeLeaves.length - b;
    c = tree.leaves.length-a-b-d;
    // console.log(a,b,c,d)   // Allos to see the distribution of a, b, c and d in the contigency table
    let FETResult = (manyFET(a, b, c, d));
    cellpvalue.appendChild(document.createTextNode(FETResult.toPrecision(5,4)))        ;
    if (FETResult.lt(significantLevel.toString())){
        row.setAttribute("style", "color: red");
        cellsignificant.appendChild(document.createTextNode("Significant"))
    }
    else if ($("#only-significants")[0].checked){
        row.setAttribute("style", "visibility: collapse")
    }
    row.appendChild(cell);
    row.appendChild(cellpvalue);
    row.appendChild(cellsignificant);
    table.appendChild(row)
}

/**
 * Same as the previous function but for the SNPS
 * @param AnnotatedSNPsInTree
 * @param characteristic
 * @param significantLevel
 * @param table
 * @param selectedChar
 * @param lengthofSNPsInSubtree
 * @param branch
 */
function updateSignificanceRowForSNPS(AnnotatedSNPsInTree, characteristic, significantLevel, table, selectedChar, lengthofSNPsInSubtree, branch){
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    const cellpvalue = document.createElement("td");
    const cellsignificant = document.createElement("td");

    let a = 0, b = 0, c = 0, d = 0;
    let haveCharacteristic;
    if (selectedChar.indexOf("GO_IDs") !== -1)
        haveCharacteristic = SNPS_EFFECTS.filter(snp => snp[selectedChar].includes(characteristic));
    else
        haveCharacteristic = SNPS_EFFECTS.filter(snp => snp[selectedChar] === characteristic);
    let leavesInSubtree = Object.values(extractLeavesInSubtree(branch.id));
    let leavesWithCharacteristics = extractLeavesIDsWithSNPs(haveCharacteristic);
    b = leavesInSubtree.filter(leaf => leavesWithCharacteristics.indexOf(leaf.label) !== -1).length;
    d = leavesWithCharacteristics.length - b;
    a = leavesInSubtree.length - b;
    c = tree.leaves.length -a-b-d;
    let celllinkToShow = $('<td></td>').text(characteristic).hover(function(){ $(this).css('cursor', 'pointer') },
        function(){ $(this).css('cursor', 'default') });
    celllinkToShow.click( function() {markNodesWithSNPEffect( selectedChar, characteristic,a,b,c,d)}).appendTo(row);
    if(selectedChar.indexOf("GO_IDs") !== -1 && GOA !== undefined)
        $('<td></td>').text(GOA[characteristic]).appendTo(row);
    let resultSign = manyFET(a, b, c, d);
    cellpvalue.appendChild(document.createTextNode(resultSign.toPrecision(5,4)));
    if (resultSign.lt(significantLevel.toString())){
        row.setAttribute("style", "color: red");
        cellsignificant.appendChild(document.createTextNode("Significant"))
    }
    else if ($("#only-significants")[0].checked){
        row.setAttribute("style", "visibility: collapse")
    }
    row.appendChild(cellpvalue);
    row.appendChild(cellsignificant);
    table.appendChild(row)
}

/**
 * Becomes an array of SNPs with their effects and returns the leaves that are affected through them.
 * @param SNPSEffectArray
 * @returns {Array}
 */
function extractLeavesIDsWithSNPs(SNPSEffectArray){
    let leavesWithSNPS = [];
    for (let i = 0; i < SNPSEffectArray.length; i++){
        let leavesWithASNP = SNP_TABLE_DICT[SNPSEffectArray[i].Position][SNPSEffectArray[i].Allele];
        leavesWithSNPS = leavesWithSNPS.concat(leavesWithASNP);
    }
    let noDup = [];
    $.each(leavesWithSNPS, function(i, el){
        if($.inArray(el, noDup) === -1) noDup.push(el);
    });
    return noDup
}

/**
 * Does many FET but with the logarithm.
 * This way it is faster and can handle bigger data.
 * Gives the p-value for the distribution with the extreme values inside the tree.
 * @param a
 * @param b
 * @param c
 * @param d
 * @returns {*|Decimal}
 */
function manyFET(a, b, c, d) {
    let pValue = new Decimal (0);
    // let phi =  ((c*b)-(a*d))/((a+b)*(c+d)*(a+c)*(b+d));
    do {
        let fetProb = Decimal.exp(FETlog(a, b, c, d));
        pValue = pValue.plus(fetProb);
        a--;
        b++;
        c++;
        d--;

    } while (a >= 0 && d>=0 && c >= 0 && b>=0);
    return pValue;
}


/**
 * Fishers Exact Test with the logartihms
 *         CHAR
 *       |0   |   1
 *    -----------------
 *     1| a   |  b
 *     -----------------
 * ST  0| c   |  d
 *
 *
 * @param a
 * @param b
 * @param c
 * @param d
 * @returns {*|Decimal}

 */
function FETlog(a, b, c, d) {
    let above = logfact(a+b).plus(logfact(c+d)).plus(logfact(a+c)).plus(logfact(d+b));
    let below = logfact(a).plus(logfact(b)).plus(logfact(c)).plus(logfact(d)).plus(logfact(a+b+c+d));
    return above.minus(below)
}

/**
 * Takes the logfact and saves the number in cache
 * @param n
 * @returns {*}
 */
function logfact(n){
    if (typeof f[n] !== 'undefined')
        return f[n];
    let logfactres = f[flength-1];
    for (; flength <= n; flength++){
        let logofnum = Decimal.ln(flength.toString());
        f[flength] = logfactres = logfactres.plus(logofnum)
    }
    return logfactres;
}



/**
 * Given the category and the effect of the SNP,
 * it returns the SNPs that fulfil the criteria.
 *
 * @param category
 * @param effect
 * @param a
 * @param b
 * @param c
 * @param d
 */
function markNodesWithSNPEffect(category, effect,a,b,c,d){
    removeSNPEffect();
    let foundSNPS;
    if (category.indexOf("GO_IDs") !== -1)
        foundSNPS = SNPS_EFFECTS.filter(snp => snp[category].includes(effect));
    else
        foundSNPS = SNPS_EFFECTS.filter(snp => snp[category] === effect);
    updateEffectVisualisation(category, effect, foundSNPS);
    let foundNodes = Object.values(allNodes).filter(node =>
        node.internalData.nonSNPs === undefined ? ( // Is nonSNPS empty?
                node.internalData.SNPs === undefined ?  // If yes, check if supSNPs is empty
                    false   :                                   //If yes, there is no SNP here
                    node.internalData.SNPs.some(SNP =>          // If not, look for a SNP that matches some SNP
                        foundSNPS.some(fSNP =>                  // within foundSNPs
                            fSNP.Position === SNP.position && fSNP.Allele === SNP.base)))
            :  // If non SNPs is not empty look first there! It is faster
            ((node.internalData.nonSNPs.some(SNP =>
                    foundSNPS.some(fSNP =>
                        fSNP.Position === SNP.position && fSNP.Allele === SNP.base))) ? //Did this search retrieved something?
                    true: //If yes, all good
                    ( node.internalData.SNPs === undefined ? // If not, check if this node has supSNPs
                        false   : //If not, this node does not have anything
                        node.internalData.SNPs.some(SNP => // if yes, search there!
                            foundSNPS.some(fSNP =>
                                fSNP.Position === SNP.position && fSNP.Allele === SNP.base)))
            ));
    foundNodes.forEach(function(node){
        node.highlighted = true;
        node.highlightColour = "red";
    });
    tree.draw();
}


/**
 * It updates the table for the SNP Effect Visualation
 * @param category
 * @param effect
 * @param snps
 */
function updateEffectVisualisation(category, effect, snps) {
    let rowID = $("<tr></tr>");
    $("<td></td>").text("Subtree ID").appendTo(rowID);
    $("<td></td>").text(tree.getAllSubtreeRootIdsWithFlag("selected")).appendTo(rowID);
    let rowCat = $("<tr></tr>");
    $("<td></td>").text("Category").appendTo(rowCat);
    $("<td></td>").text(category).appendTo(rowCat);
    let rowEffect = $("<tr></tr>");
    $("<td></td>").text("Characteristic").appendTo(rowEffect);
    $("<td></td>").text(effect).appendTo(rowEffect);
    $("#SNP-eff-vis-table").append(rowID).append(rowCat).append(rowEffect);
    if (GOA !== undefined && category.indexOf("GO_IDs") !== -1) {
        let rowDescription = $("<tr></tr>");
        $("<td></td>").text("GO-Description").appendTo(rowDescription);
        $("<td></td>").text(GOA[effect]).appendTo(rowDescription);
        $("#SNP-eff-vis-table").append(rowDescription);
    }
    let rowSNPs = $("<tr></tr>");
    $("<td></td>").text("SNPs involved").appendTo(rowSNPs);
    let link = $('<a></a>').text("Visualize").click( function(e) {e.preventDefault(); addManyToList(snps); return false; } );
    $("<td></td>").append(link).appendTo(rowSNPs);
    $("#SNP-eff-vis-table").append(rowSNPs);
    $("<tr></tr>").append($("<button></button>").text("Remove").click(function(){
        removeSNPEffect()})).appendTo("#SNP-eff-vis-table");


}

/**
 * Takes an array of SNPs Effects and visualizes them
 * @param snps
 */
function addManyToList(snps) {
    for(let i = 0; i<snps.length; i++){
        if (VISUALIZING.length === MAX_VISUALIZE) {
            alert("The maximum of SNPs has been reached.");
            break;
        }
        addToList(snps[i].Position);
    }
}
/**
 * removes highlights from the SNP Effect visualization
 */
function removeSNPEffect() {
    resetContainer(document.getElementById("SNP-eff-vis-table"));
    Object.values(tree.branches).forEach(function (branch){
        branch.setDisplay({colour: "black"});
        branch.highlighted = false;
        branch.highlightColour = undefined;
        branch.selected ? branch.setDisplay({colour: "blue"}) : false;
    });
    tree.draw()
}

/**
 * Extracts all SNPs in the tree.
 * Gives an Array of them
 * @returns {Array}
 */
function extractAllSNPS(){
    const nodesSubtree = extractNodesInSubtree(tree.root);
    const uniqSupprtSNPs = uniqueSNPInSubtree(nodesSubtree, "D");
    const uniqNonSupprtSNPs = uniqueSNPInSubtree(nodesSubtree, "N");
    const allSNPS = uniqNonSupprtSNPs.concat(uniqSupprtSNPs);
    return allSNPS
}

