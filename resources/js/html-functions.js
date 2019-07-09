/***
 * @overview
 * Sumarry.
 * All functions here have mainly a purpose of changing the HTML Structure of Evidente.
 *
 * Description.
 * As stated above, all functions here change the HTML elements of Evidente.
 * Here is especially focused on the changes on the panels.
 *
 *
 * @author Mathias Witte Paz mathiaswittepaz@gmail.com
 * @required pc-functions.js
 * @required Libray_Phylocanvas.js
 */


/**
 * Function that updates the shown information depending on the node that has been clicked.
 * It calls for an unpdate of the respecting unique SNPs on the tables.
 * @param {Object} node - the node that was clicked.
 */
function changeNodeDetailInformation(node) {
    const genInfo = document.getElementById("collapse1");
    const genInfoLink = document.getElementById("genInfoLink");
    if (genInfo.getAttribute("class") === "panel-collapse collapse"){
        genInfoLink.click();
    }
    const parent = document.getElementById("detail-info");
    const normalWidth = parent.width;
    let panel = document.getElementsByClassName("panel-group");
    panel[0].setAttribute("style", "width: " + normalWidth + "px");
    let supportInfo = document.getElementById("support-info");
    let nonSupportInfo = document.getElementById("non-support-info");
    let id = document.getElementById("node-id");
    id.innerHTML = node.id;
    let label = document.getElementById("node-label");
    label.innerHTML = node.label;

    // This part is fixed to a place and date of origin, reconsider:
    if (node.leaf) {
        updateAdditionalNodeInfo(node);
    }
    else{
        resetContainer(document.getElementById("add-info-node"))
    }
    //

    const newWidth = parent.scrollWidth;
    panel[0].setAttribute("style", "width: " + newWidth + "px");
    resetContainer(supportInfo);
    resetContainer(nonSupportInfo);
    const nodesSubtree = extractNodesInSubtree(node);
    const uniqSupprtSNPs = uniqueSNPInSubtree(nodesSubtree, "D");
    if (typeof uniqSupprtSNPs !== "undefined") {
        updateSNPTable(supportInfo, uniqSupprtSNPs);
    }
    const uniqNonSupprtSNPs = uniqueSNPInSubtree(nodesSubtree, "N");
    if (typeof uniqNonSupprtSNPs !== "undefined") {
        updateSNPTable(nonSupportInfo, uniqNonSupprtSNPs);
    }
}

/**
 * Updates the additional information of the node clicked.
 * This function is called only if the node is a leaf.
 *
 * @param {Object} node - the node clicked
 */
function updateAdditionalNodeInfo(node){
    resetContainer(document.getElementById("add-info-node"));
    let additional = node.internalData.additionalInfo;
    if (additional === undefined)
        $("#add-info-node").text("No additional information loaded");
    else{
        let keysOfDict = Object.keys(additional);
        createMultiselect(keysOfDict, "Visualize following labels: ", "selected-node-labels", document.getElementById("add-info-node"), {onClose: function () {
                showSelectedInfos([additional], $("#selected-node-labels").multipleSelect("getSelects"), "add-info-node-table");
            }});
        $("#selected-node-labels").multipleSelect("checkAll");
        $("#add-info-node").append($('<br>'));
        let table = $('<table></table>', {
            id: "add-info-node-table",
            style: "width: 100%"
        });
        $("#add-info-node").append(table);
        showSelectedInfos([additional], $("#selected-node-labels").multipleSelect("getSelects"), "add-info-node-table");

    }
   }

/**
 * Deletes elements on the given container
 * @param {Object} el - the container that needs to be reseted
 */
function resetContainer(el) {
    while (el.hasChildNodes()) {
        el.removeChild(el.lastChild);
    }
}


/**
 * Sets the node size depending on the value given.
 * @param {int} newValue - the new size of the nodes
 */
function showValue(newValue) {
    document.getElementById("range").innerHTML = newValue;
    tree.setNodeSize(newValue);
}

/**
 * Called when the user searches for a SNP.
 * Gets SNP position from Text input.
 * Calls addtolist, in order to add the SNP to the Visualization List.
 *
 */
function getInputValue() {
    const inputSNP = document.getElementById('inputSNP').value;
    addToList(inputSNP);

}

/**
 * Shows the detailed information of the SNP given, if available.
 * gets called by addToList.
 * @param {int} SNP - position of the SNP
 *
 */
function showSNPSDetails(SNP){
    if (SNP_EFFECT_FILE !== undefined) {
        remarkSNP(SNP);
        let tableDetail = document.getElementById("snp-detail-info");
        let container = document.getElementById("collapse-snp-info-options");
        resetContainer(tableDetail);
        resetContainer(container);
        if ($("#collapse-snp-info").attr("class") === "panel-collapse collapse") {
            $("#snpInfoLinkheader").click();
        }
        let matches = SNPS_EFFECTS.filter(snp => snp.Position === SNP);
        if (matches.length === 0)
            $('#snp-detail-info').append('<tr><th colspan="2"> No detail information available for position ' + SNP + '</th></tr>');
        else {
            let keysOfDict = Object.keys(matches[0]);
            createMultiselect(keysOfDict, "Visualize following labels: ", "selected-labels", container, {
                onClose: function () {
                    showSelectedInfos(matches, $("#selected-labels").multipleSelect("getSelects"), "snp-detail-info");
                }
            });
            $("#selected-labels").multipleSelect("checkAll");
            $("#collapse-snp-info-options").append($('<br>'));
            showSelectedInfos(matches, $("#selected-labels").multipleSelect("getSelects"), "snp-detail-info");

        }
    }
}

/**
 * It filters the information within a selected checklist.
 * Allows the user to visualize the important information
 *
 * @param {Array} matches - The matched inforamtion ie SNPs to visualize
 * @param {Array} selected - The selected informations to visualize
 * @param {String} containerID - ID of the html-el, where the information will be shown.
 */
function showSelectedInfos(matches, selected, containerID) {
    resetContainer(document.getElementById(containerID));
    for (let i = 0; i < matches.length; i++){
        if (containerID.indexOf("snp") !== -1)
            $('#'+containerID).append('<tr><th colspan="2"> Allele '+ (i+1) +'</th></tr>');
        Object.keys(matches[i]).forEach(function(key) {
            if (selected.indexOf(key) !== -1)
                $('#'+containerID).append('<tr><td>'+key+'</td><td>'+matches[i][key]+'</td></tr>');
        });
    }
}
/**
 * Adds the given SNP position to the visualization.
 * It also adds it to the VISUALIZING array
 * and to the list of SNPs.
 *
 * @param {int} inputSNP - Position of the SNP
 */
function addToList(inputSNP) {
    if (VISUALIZING.length < MAX_VISUALIZE) {
        showSNPSDetails(inputSNP);
        const listSNP = document.getElementById('listSNP');
        const entry = document.createElement('li');
        const link = document.createElement("a");
        const linkSNP = document.createElement("a");
        link.setAttribute("style", "margin-left: 0.625em; margin-bottom: 0.5em");
        const removeImg = document.createElement('img');
        removeImg.setAttribute("src", "resources/images/close_normal.svg");
        removeImg.setAttribute("style", "width: 1.25em; cursor: pointer; ");
        removeImg.setAttribute("onmouseover", "this.src='resources/images/close_hover.svg';");
        removeImg.setAttribute("onmouseout", "this.src='resources/images/close_normal.svg';");
        if (VISUALIZING.indexOf(inputSNP) === -1) {
            const snpInfo = document.getElementById("collapset3");
            const snpInfoLink = document.getElementById("snpInfoLink");
            if (snpInfo.getAttribute("class") === "panel-collapse collapse"){
                snpInfoLink.click();
            }
            const labelOfData = "SNP" + SNPid;
            let nodesFound = (searchInNodes("D", inputSNP));
            nodesFound = nodesFound.concat(searchInNodes("N", inputSNP));
            if (nodesFound.length !== 0) {
                addDataIntoNodes(nodesFound, inputSNP, labelOfData);
                VISUALIZING.push(inputSNP);
                entry.appendChild(document.createTextNode(labelOfData + ": "));
                linkSNP.setAttribute('onClick', 'showSNPSDetails("' + inputSNP + '")');
                linkSNP.innerText = inputSNP;
                entry.appendChild(linkSNP);
                entry.setAttribute('id', labelOfData);
                link.setAttribute('onClick', 'removeSNP("' + labelOfData + '")');
                link.appendChild(removeImg);
                entry.appendChild(link);
                SNPid++;
                listSNP.appendChild(entry);
            }
            else
                alert("No SNP found at position " + inputSNP);
        }
        else
            alert("The SNP at position " + inputSNP + " is already being visualized.")
    }
    else
        alert("The maximum of " + MAX_VISUALIZE + " SNPs to visualize has been reached");
}

/**
 * Deletes the SNP from the VISUALIZING array
 * and from the visualization in the tree.
 * @param {string} itemid - ID of the HTML el that contains the position of the SNP.
 */
function removeSNP(itemid) {
    try {
        let listSNP = document.getElementById('listSNP');
        let temp, temp2;
        let item = document.getElementById(itemid);
        if (item === undefined) throw "not existant";
        const SNPnumber = (item.textContent.substr(item.textContent.indexOf(":") + 2,));
        const indexOfVis = VISUALIZING.indexOf(SNPnumber);
        let allnodes = tree.branches;
        for (const [key, value] of Object.entries(allnodes)) {
            value.colour = "black";
            if (value.leaf)
                delete value.data[itemid];
        }
        tree.draw();
        if (VISUALIZING.length === 1 || indexOfVis === VISUALIZING.length - 1) {
            VISUALIZING.pop();
        }
        else if (indexOfVis === 0) {
            VISUALIZING.shift();
        }
        else {
            temp = VISUALIZING.slice(0, indexOfVis);
            temp2 = VISUALIZING.slice(indexOfVis + 1);
            VISUALIZING = temp.concat(temp2);
        }
        listSNP.removeChild(item);
        if (VISUALIZING.length === 0) {
            SNPid = START_SNP_ID;
        }
    }
    catch (e) {
        console.log("Missing ID: " + itemid);
    }
}

/**
 * Like expected, resets the List of SNPs.
 */
function resetSNPList() {
    const ul = document.getElementById("listSNP");
    const visualizedSNPs = ul.getElementsByTagName("li");
    while (visualizedSNPs.length !== 0) {
        visualizedSNPs[0].lastChild.click();
    }
}

/**
 * From the two selected subtrees, find all SNPs that these have in common.
 * For the case of supporting SNPs, it goes to the LCA and takes the snps from there.
 * For the case of the non-supporting SNPs:
 * It looks in all nodes that lie between the LCA and the leaves.
 * Then shows the ones they have in common.
 *
 */
function commonSNPs() {
    try {
        let commonSNP = [];
        const selectedNodes = tree.getAllSubtreeRootIdsWithFlag("selected");
        if (selectedNodes.length < 2) throw "Please select at least two subtrees";
        let allNodesInSubtrees = extractNodesInSubtrees(selectedNodes);
        let text;
        const LCA = findLCAofNodes(selectedNodes);
        let nonSNPsInSubtrees = [];
        for (let i = 0; i < selectedNodes.length; i++) {
            let nodesInThisSubtree = extractNodesInSubtree(tree.branches[selectedNodes[i]]);
            let nodesBetweenSubAndLCA = nodesInPath(tree.branches[selectedNodes[i]], LCA);
            let allNodesToConsider = nodesInThisSubtree.concat(nodesBetweenSubAndLCA).concat(LCA.id);
            let nonSNPsInSubtree = extractSNPsFromNodes(allNodesToConsider, "N");
            nonSNPsInSubtrees.push(nonSNPsInSubtree);
        }
        for (let i = 0; i < nonSNPsInSubtrees.length - 1; i++) {
            if (i === 0)
                commonSNP = extractIntersection(nonSNPsInSubtrees[i], nonSNPsInSubtrees[i + 1]);
            else
                commonSNP = extractIntersection(commonSNP, nonSNPsInSubtrees[i + 1])
        }
        let LCASnps = LCA["internalData"]["SNPs"];
        if (LCASnps !== undefined)
            commonSNP = commonSNP.concat(LCASnps);
        commonSNP = sort(commonSNP);
        commonSNP = deleteDuplicatesOfSNPs(commonSNP);
        if (commonSNP !== undefined && commonSNP.length > 0) {
            const comInfo = document.getElementById("collapse4");
            const comInfoLink = document.getElementById("commonInfoLink");
            if (comInfo.getAttribute("class") === "panel-collapse collapse"){
                comInfoLink.click();
            }
            const commonTable = document.getElementById("common-info");
            const titleTable = document.getElementById("subtree-title");
            resetContainer(commonTable);
            titleTable.innerHTML = "Information from Subtrees: " + selectedNodes.join(",");
            if (isAClade(selectedNodes, LCA)){
                //If all selected Subtrees form a clade, then add the LCA to the group.
                allNodesInSubtrees.push(LCA.id.toString());
            }
            let uniqueCommonSNP = onlyUniquesInSubtree(allNodesInSubtrees, commonSNP, "N");
            uniqueCommonSNP = uniqueCommonSNP.concat(onlyUniquesInSubtree(allNodesInSubtrees, commonSNP, "D"));
            updateSNPTable(commonTable, commonSNP, uniqueCommonSNP);
        }
        else throw  "No common SNPs between all of these subtrees";
    }
    catch (e) {
        const comInfo = document.getElementById("collapse4");
        const comInfoLink = document.getElementById("commonInfoLink");
        if (comInfo.getAttribute("class") === "panel-collapse collapse"){
            comInfoLink.click();
        }
        const commonTable = document.getElementById("common-info");
        const titleTable = document.getElementById("subtree-title");
        resetContainer(commonTable);
        titleTable.innerHTML = e;
    }
}

/**
 * Updates the table that displays the SNPs.
 * It gives each position a link to the function that shows the clicked SNP.
 * @param {Object} el - decides which HTML table is going to be modified
 * @param {Array} arraySNPs,- uniqueSNPs of the Subtree
 * @param {Array} uniqueness - gives an array showing which SNPs are unique
 */
function updateSNPTable(el, arraySNPs, uniqueness) {
    $("#"+el.id).append("<tr><td colspan='2'>Number of SNPs: "+arraySNPs.length+ "</td> </tr");
    for (let item = 0; item < arraySNPs.length; item++) {
        const textPosition = arraySNPs[item].position;
        const textBase = arraySNPs[item].base;
        const row = document.createElement("tr");
        el.appendChild(row);
        const cellPosition = document.createElement("td");
        const cellUniqueness = document.createElement("td");
        const cellBase = document.createElement("td");
        let link = document.createElement("a");
        link.setAttribute("onClick", 'addToList("' + textPosition + '")');
        link.setAttribute("style", "cursor: pointer; color: inherit");
        cellPosition.appendChild(link);
        link.appendChild(document.createTextNode(textPosition));
        row.appendChild(cellPosition);
        cellBase.innerHTML = textBase;
        row.appendChild(cellBase);
        if (uniqueness !== undefined && uniqueness.findIndex((i => i.position === textPosition && i.base === textBase)) !== -1){
            cellUniqueness.innerHTML = "Unique".italics();
        }
        row.appendChild(cellUniqueness);
    }
}

/**
 * Updates the information of an Multiple Check List
 * @param {Array} array - Contains the elements for the list
 * @param {Object} el - HTML element that needs to be updated
 * @param {boolean} isCountry - If the information is a country in ISO3166 it translates it.
 */
function updateDroplist(array, el, isCountry){
    resetContainer(el);
    for (let j = 0; j < array.length; j++){
        let single = document.createElement("option");
        let value = array[j];
        if (isCountry) //Translate Country from ISO3166 alpha3 to Name
            value = whereAlpha3(value).country;
        single.innerHTML = " "+ value;
        el.appendChild(single);
    }
}

/**
 * Using the inforamtion of the dictionary, it creates many ranges for the filter.
 *
 * @param {Object} dict - Dictionary where the information is contained
 * @param {Object} container - HTML object that will contain all the ranges
 */
function createManyRanges(dict, container) {
    for (let key in dict){
        let subcontainer = document.createElement("div");
        let id = transformToHTMLID(key);
        subcontainer.setAttribute("id", id+"-container");
        container.appendChild(subcontainer);
        createRange(dict[key], key+":", id, subcontainer );
        container.appendChild(document.createElement("br"));
        let button = document.createElement("input");
        button.setAttribute("id", id+"-container-add");
        button.setAttribute("type", "button");
        button.setAttribute("onclick", "addNewRange(\""+id+"1\", \""+subcontainer.id+"\")");
        button.setAttribute("value", "Add more");
        container.appendChild(button);
    }
}

/**
 * Creates one range, with the information of an Array,
 * the tilte of the range, the ID and where it is going to be contained.
 * @param {Array} arr - Contains the information of the range
 * @param {String} text - Title of the range
 * @param {string} id - ID of the htmlElement
 * @param {Object} container - HTML object that contains the range.
 */
function createRange(arr, text, id, container){
    container.appendChild(document.createTextNode(text));
    container.appendChild(document.createElement("br"));
    let range = document.createElement("input");
    range.setAttribute("type", "text");
    range.setAttribute("id", id+"1");
    range.setAttribute("value", "");
    range.setAttribute("class", "span2");
    container.appendChild(range);

    $("#"+id+"1").slider({id: id+"_1",step: 1, min: 0, max: arr.length-1, tooltip: "show", value: [0,arr.length-1], formatter: translateValueOfRange});
    $("#"+id+"1 .tooltip.tooltip-main").on('click', function(e) {        e.stopPropagation()});
}


/**
 * From a dictionary, creates many multiple select boxes.
 * @param {Object} dict - Contains the information
 * @param {Object} container - HTML Object that contains the Checklist
 */
function createManyMultiselect(dict, container) {
    for (let key in dict){
        createMultiselect(dict[key], key+":", transformToHTMLID(key), container )
    }
}

/**
 * Creates a single multicheck list
 * @param {Array} arr - options inside list
 * @param {String} text - the title
 * @param {String} id - ID of the created Element
 * @param {Object} container - HTML element that will contain this checklist
 * @param {Object} opts - additional options for the multiselect ({onClose: ..., single: true/false})
 */
function createMultiselect(arr, text, id, container, opts){

    container.appendChild(document.createTextNode(text));
    container.appendChild(document.createElement("br"));
    let multiselectBox = document.createElement("select");
    multiselectBox.setAttribute("id", id);
    container.appendChild(multiselectBox);
    $("#"+id).attr("multiple", "multiple");
    $("#"+id).attr("style", "width:14em");
    if (text.indexOf("Place") !== -1 ||text.indexOf("Countries") !== -1 )
        updateDroplist(arr, multiselectBox, true);
    else
        updateDroplist(arr, multiselectBox);
    if (opts !== undefined)
        $('#'+id).multipleSelect(opts);
    else
    $('#'+id).multipleSelect();
    container.appendChild(document.createElement("br"));
}

/**
 * Gives the possibility of creating a new Range with the same information.
 * Allows the usage of disjoint ranges.
 *
 * @param {String} id - ID of the new element
 * @param {String} containerid - ID of the container of the whole group
 */
function addNewRange(id, containerid) {
    let rangeInput = document.getElementById(id);
    let rangeContainer = document.getElementById(containerid);
    let childrenOfRange = $("#"+containerid +"> input:text").length;
    if($("#"+id).slider("isEnabled")){
        if (rangeInput.id.indexOf("1") === -1)
            $("#rem"+id).remove();
        let rangeCopy = rangeInput.cloneNode(true);
        let addButton = document.getElementById(containerid+"-add");
        $("#"+containerid+"-add").remove();
        let basicID = containerid.substring(0,containerid.indexOf("-container"));
        let dictID = transformToDictID(basicID);
        let newIDNum = (childrenOfRange + 1);
        let newID = id.replace(childrenOfRange, newIDNum);
        rangeCopy.setAttribute("id", newID);
        let removeButton = document.createElement("input");
        removeButton.setAttribute("type", "button");
        removeButton.setAttribute("id", "rem"+newID);
        removeButton.setAttribute("value", "Delete range");
        removeButton.setAttribute("onclick", "removeElement(\""+newID+"\", \""+containerid+"\")");
        addButton.setAttribute("onclick", "addNewRange(\""+newID+"\", \""+containerid+"\")");
        rangeContainer.appendChild(rangeCopy);
        let breakline = $("<br>").attr("id", "br"+containerid+childrenOfRange);
        rangeContainer.appendChild(addButton);
        if (childrenOfRange > 4)
            $("#"+containerid+"-add").attr("style", "display: none");
        rangeContainer.appendChild(removeButton);
        let maxValue = RANGES[dictID].length-1;
        $("#"+newID).slider({id: basicID+"_"+newIDNum,step: 1, min: 0, max: maxValue, tooltip: "show", value: [0,maxValue], formatter: translateValueOfRange});
        $("#"+newID).slider("refresh");
        $("#"+newID).slider("enable");
    }
}

/**
 * Removes the element given
 * @param {String} id - ID of the elemnt to remove
 * @param {String} containerid - ID of the container
 */
function removeElement(id, containerid){
    $("#"+id).slider("destroy");
    $("#"+id).remove();
    let childrenOfRange = $("#"+containerid+" > input:text").length;
    let newID = id.replace(childrenOfRange+1, childrenOfRange);
    if (childrenOfRange !== 1){
        $("#br"+containerid+childrenOfRange).remove();
        let copyRemove = $("#rem"+id).clone();
        copyRemove.attr("id", "rem"+newID);
        copyRemove.attr("onclick", "removeElement(\""+newID+"\", \""+containerid+"\")");
        copyRemove.appendTo("#"+containerid);

    }
    $("#rem"+id).remove();
    $("#"+containerid+"-add").attr("onclick", "addNewRange(\""+newID+"\", \""+containerid+"\")");
    $("#"+containerid+"-add").show();


}

/**
 * Creates modal for the analysis and resets it.
 * @param {Object} branch - Branch where the analysis is called
 */
function prepareModal(branch) {
    const modal = document.getElementById('modal-analytics');
    let modalContent = document.getElementById('content');
    resetContainer(modalContent);
    // Get the <span> element that closes the modal
    const span = document.getElementsByClassName("close")[0];
    // When the user clicks on <span> (x), close the modal
    span.onclick = function () {
        modal.style.display = "none";
        document.getElementById("loader").style.display = "none";
    };
    // When the user clicks anywhere outside of the modal, close it
    window.onclick = function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
            document.getElementById("loader").style.display = "none";
        }
    };
    modal.style.display = "block";
    modal.style.zIndex = 2001;
    $('#content').append("<span>Subtree ID: </span>" + branch.id + "<br>");
    createMultiselect(SIGNIFICANCE_LEVEL, "Significance level", "significance-values", document.getElementById('content'), {single: true});
    $("#significance-values").children()[0].selected = "selected";
    $("#significance-values").multipleSelect("refresh");

}

/**
 * Creates bottom part of the modal.
 */
function addBottomModal() {
    let text = $('<p></p>', {
        id: "text-in-modal",
    });
    $('#content').append(text);
    let checktext = $('<span></span>', {
        id: "checktext",
        text: "Show only significant results: "
    });
    $('#content').append(checktext);
    let checkbox = $('<input>', {
        type: "checkbox",
        id: "only-significants",
        visibility: "hidden",
        change: function (){onlySignificants()}
    });
    $('#content').append(checkbox);
    let signTable = $('<table></table>', {
        id: "significance-table",
        align: "center"
    });
    $('#content').append(signTable);
    let exportText = $('<a></a>', {
        id: "enrichment-analysis",
        text: 'Export to file...',
        click: function () {
            exportTable('significance-table')
        }

    });
    $('#content').append(exportText);
}

/**
 * Shows only the significant values. The rest is collapsed/hidden.
 * Collapse does not work in Safari properly
 */
function onlySignificants(){
    $("#significance-table > tr").each(function() {
        $this = $(this);
        if ($this.attr("style") !== "color: red"){
            if($("#only-significants")[0].checked)
                $this.attr("style", "visibility: collapse");
            else
                $this.attr("style", "visibility: visible");
        }

    });

}

/**
 * Shows loader while executing analysis
 */
function showLoader(){
    document.getElementById("loader").style.display = "block";
}


/**
 * Highlights the SNP in the canvas and shows its information on the respective panel.
 *
 * @param {int} inputSNP - Position of the desired SNP
 */
function remarkSNP(inputSNP){
    let nodesFound = (searchInNodes("D", inputSNP));
    nodesFound = nodesFound.concat(searchInNodes("N", inputSNP));
    let allnodes = tree.branches;
    for (const [key, value] of Object.entries(allnodes)) {
        value.colour = "black";
        let foundSNP, base, color;
        if (nodesFound.indexOf(key) !== -1) {
            let SNPsOfNode = allnodes[key]['internalData']['SNPs'];
            let nonSNPsOfNode = allnodes[key]["internalData"]["nonSNPs"];
            if (nonSNPsOfNode !== undefined) {
                foundSNP = nonSNPsOfNode.find(P => P.position === inputSNP);
                if (foundSNP !== undefined) {
                    base = foundSNP['base'];
                    color = "black";
                }
                else {
                    foundSNP = SNPsOfNode.find(P => P.position === inputSNP);
                    base = foundSNP['base'];
                    color = colourBase(base);
                }
            }
            else {
                foundSNP = SNPsOfNode.find(P => P.position === inputSNP);
                base = foundSNP['base'];
                color = colourBase(base);
            }
            allnodes[key].colour = color;
            inheritColor(allnodes[key],color)
        }
    }
    tree.draw()
}