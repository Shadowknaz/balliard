import * as PIXI from 'pixi.js';

// --- Data Models ---
export interface Position {
    x: number;
    y: number;
}

export interface NodeData {
    id: string;
    type: 'root' | 'minor' | 'notable' | 'keystone';
    position: Position;
    max_level: number;
    connections: string[]; // Parent IDs
}

export interface TalentSchema {
    nodes: NodeData[];
}

// --- Visual Config ---
const NODE_STYLES = {
    root: { radius: 40, color: 0xffffff, outline: 0x888888 },
    minor: { radius: 15, color: 0x3498db, outline: 0x2980b9 },
    notable: { radius: 25, color: 0xf1c40f, outline: 0xf39c12 },
    keystone: { radius: 35, color: 0x9b59b6, outline: 0x8e44ad }
};

// --- Main App ---
class TalentEditor {
    private app: PIXI.Application;
    private cameraContainer: PIXI.Container;
    private connectionsGraphics: PIXI.Graphics;
    private ghostConnectionGraphics: PIXI.Graphics;
    
    private nodesData: Map<string, NodeData> = new Map();
    private visualNodes: Map<string, PIXI.Container> = new Map();

    private isDraggingNode: boolean = false;
    private draggedNodeId: string | null = null;
    
    private isCreatingConnection: boolean = false;
    private connectionStartNodeId: string | null = null;
    private ghostEndPos: Position | null = null;

    private selectedNodeId: string | null = null;

    // UI Elements
    private ctxPopup = document.getElementById('contextPopup') as HTMLDivElement;
    private propInspector = document.getElementById('propertyInspector') as HTMLDivElement;
    
    constructor() {
        this.app = new PIXI.Application({
            view: document.getElementById('editorCanvas') as HTMLCanvasElement,
            resizeTo: window,
            backgroundColor: 0x1a1a1a,
            antialias: true
        });

        // Main container centered
        this.cameraContainer = new PIXI.Container();
        this.cameraContainer.x = this.app.screen.width / 2;
        this.cameraContainer.y = this.app.screen.height / 2;
        this.app.stage.addChild(this.cameraContainer);

        // Graphics for connections
        this.connectionsGraphics = new PIXI.Graphics();
        this.cameraContainer.addChild(this.connectionsGraphics);

        // Graphics for ghost connection
        this.ghostConnectionGraphics = new PIXI.Graphics();
        this.cameraContainer.addChild(this.ghostConnectionGraphics);

        this.initRootNode();
        this.setupInteraction();
        this.setupUI();
        this.app.ticker.add(() => this.drawConnections());
    }

    private initRootNode() {
        const rootData: NodeData = {
            id: 'root',
            type: 'root',
            position: { x: 0, y: 0 },
            max_level: 1,
            connections: []
        };
        this.nodesData.set(rootData.id, rootData);
        this.createVisualNode(rootData);
    }

    private createVisualNode(data: NodeData) {
        const container = new PIXI.Container();
        container.position.set(data.position.x, data.position.y);
        container.eventMode = 'static';
        container.cursor = 'pointer';

        const style = NODE_STYLES[data.type];
        const bg = new PIXI.Graphics();
        bg.lineStyle(3, style.outline, 1);
        bg.beginFill(style.color, 1);
        
        if (data.type === 'keystone') {
            // Draw hexagon
            bg.drawPolygon([
                0, -style.radius,
                style.radius * 0.866, -style.radius * 0.5,
                style.radius * 0.866, style.radius * 0.5,
                0, style.radius,
                -style.radius * 0.866, style.radius * 0.5,
                -style.radius * 0.866, -style.radius * 0.5
            ]);
        } else {
            bg.drawCircle(0, 0, style.radius);
        }
        bg.endFill();
        container.addChild(bg);

        const text = new PIXI.Text(data.id, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xffffff,
            align: 'center',
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 4,
            dropShadowDistance: 0
        });
        text.anchor.set(0.5, 0.5);
        if(data.type !== 'root') {
            text.y = style.radius + 15;
        }
        container.addChild(text);

        // Interaction
        container.on('pointerdown', (e) => this.onNodePointerDown(e, data.id));
        
        this.cameraContainer.addChild(container);
        this.visualNodes.set(data.id, container);
    }

    private onNodePointerDown(e: PIXI.FederatedPointerEvent, nodeId: string) {
        e.stopPropagation(); // Prevent background click
        
        if (e.button === 0) { // Left click
            // Check if holding Shift to drag node vs drag connection.
            // Let's say: click edge = connect? No, just dragging from it creates connection if Shift is held?
            // "Click and drag from any existing node to pull out a Ghost Connection"
            // "Free Movement: All nodes (except Root) can be repositioned via Drag-and-Drop."
            // Let's use ALT+Drag or simply check if dragged within a few frames. 
            // Better: Dragging = Move. Shift+Drag (or Right Click) = Connect.
            // Actually, let's implement dragging from center = move, dragging from edge = connect. Or just Shift to connect.
            if (e.shiftKey) {
                this.startConnection(nodeId, e);
            } else {
                if (nodeId !== 'root') {
                    this.isDraggingNode = true;
                    this.draggedNodeId = nodeId;
                }
            }
            this.selectNode(nodeId);
        }
    }

    private startConnection(nodeId: string, e: PIXI.FederatedPointerEvent) {
        this.isCreatingConnection = true;
        this.connectionStartNodeId = nodeId;
        this.updateGhostConnection(e.global);
    }

    private setupInteraction() {
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(0, 0, window.innerWidth, window.innerHeight);

        this.app.stage.on('pointermove', (e) => {
            if (this.isDraggingNode && this.draggedNodeId) {
                const nodeData = this.nodesData.get(this.draggedNodeId);
                const visual = this.visualNodes.get(this.draggedNodeId);
                if (nodeData && visual) {
                    const localPos = this.cameraContainer.toLocal(e.global);
                    nodeData.position = { x: localPos.x, y: localPos.y };
                    visual.position.set(localPos.x, localPos.y);
                }
            }

            if (this.isCreatingConnection) {
                this.updateGhostConnection(e.global);
            }
        });

        this.app.stage.on('pointerup', (e) => {
            if (this.isDraggingNode) {
                this.isDraggingNode = false;
                this.draggedNodeId = null;
            }

            if (this.isCreatingConnection) {
                this.isCreatingConnection = false;
                // If dropped in empty space, show popup
                const localPos = this.cameraContainer.toLocal(e.global);
                // Simple collision check to see if we dropped on another node
                let droppedOnNode = false;
                for (const [id, visual] of this.visualNodes.entries()) {
                    const bounds = visual.getBounds();
                    if (bounds.contains(e.global.x, e.global.y)) {
                        droppedOnNode = true;
                        // Optional: allow connecting to existing node
                        if (id !== this.connectionStartNodeId) {
                            const data = this.nodesData.get(id);
                            if (data && !data.connections.includes(this.connectionStartNodeId!)) {
                                data.connections.push(this.connectionStartNodeId!);
                            }
                        }
                        break;
                    }
                }

                if (!droppedOnNode) {
                    this.showContextPopup(localPos);
                } else {
                    this.ghostConnectionGraphics.clear();
                }
            }
        });

        this.app.stage.on('pointerupoutside', () => {
            this.isDraggingNode = false;
            this.isCreatingConnection = false;
            this.ghostConnectionGraphics.clear();
        });

        // Background click
        this.app.stage.on('pointerdown', (e) => {
            if (e.target === this.app.stage) {
                this.selectNode(null);
            }
        });
    }

    private updateGhostConnection(globalPos: PIXI.Point) {
        if (!this.connectionStartNodeId) return;
        const startVisual = this.visualNodes.get(this.connectionStartNodeId);
        if (!startVisual) return;

        const localPos = this.cameraContainer.toLocal(globalPos);
        this.ghostEndPos = { x: localPos.x, y: localPos.y };

        this.ghostConnectionGraphics.clear();
        this.ghostConnectionGraphics.lineStyle(2, 0xaaaaaa, 0.8, 0.5, true);
        this.ghostConnectionGraphics.moveTo(startVisual.x, startVisual.y);
        this.ghostConnectionGraphics.lineTo(localPos.x, localPos.y);
    }

    private drawConnections() {
        this.connectionsGraphics.clear();
        this.connectionsGraphics.lineStyle(3, 0xffffff, 0.6);

        for (const data of this.nodesData.values()) {
            const visual = this.visualNodes.get(data.id);
            if (!visual) continue;

            for (const parentId of data.connections) {
                const parentVisual = this.visualNodes.get(parentId);
                if (parentVisual) {
                    this.connectionsGraphics.moveTo(parentVisual.x, parentVisual.y);
                    this.connectionsGraphics.lineTo(visual.x, visual.y);
                }
            }
        }
    }

    // --- UI Logic ---
    private setupUI() {
        const btnCreate = document.getElementById('btnCreateNode') as HTMLButtonElement;
        const btnCancel = document.getElementById('btnCancelNode') as HTMLButtonElement;
        
        btnCreate.addEventListener('click', () => {
            const idInput = (document.getElementById('nodeId') as HTMLInputElement).value.trim();
            const typeInput = (document.getElementById('nodeType') as HTMLSelectElement).value as any;
            
            if (!idInput) {
                alert('ID is required');
                return;
            }
            if (this.nodesData.has(idInput)) {
                alert('ID already exists');
                return;
            }

            if (this.ghostEndPos && this.connectionStartNodeId) {
                const newNode: NodeData = {
                    id: idInput,
                    type: typeInput,
                    position: this.ghostEndPos,
                    max_level: 1,
                    connections: [this.connectionStartNodeId]
                };
                this.nodesData.set(newNode.id, newNode);
                this.createVisualNode(newNode);
                this.selectNode(newNode.id);
            }
            this.hideContextPopup();
            this.ghostConnectionGraphics.clear();
            this.connectionStartNodeId = null;
            this.ghostEndPos = null;
        });

        btnCancel.addEventListener('click', () => {
            this.hideContextPopup();
            this.ghostConnectionGraphics.clear();
            this.connectionStartNodeId = null;
            this.ghostEndPos = null;
        });

        const btnSaveProps = document.getElementById('btnSaveProps') as HTMLButtonElement;
        btnSaveProps.addEventListener('click', () => {
            if (!this.selectedNodeId) return;
            const data = this.nodesData.get(this.selectedNodeId);
            if (!data) return;

            const newId = (document.getElementById('propId') as HTMLInputElement).value.trim();
            const newMaxLevel = parseInt((document.getElementById('propMaxLevel') as HTMLInputElement).value);

            if (newId !== data.id) {
                if (this.nodesData.has(newId)) {
                    alert('ID already exists');
                    return;
                }
                // Rename logic
                this.renameNode(data.id, newId);
            }

            data.max_level = newMaxLevel;
            this.selectNode(data.id); // Refresh
        });

        const btnDeleteNode = document.getElementById('btnDeleteNode') as HTMLButtonElement;
        btnDeleteNode.addEventListener('click', () => {
            if (this.selectedNodeId && this.selectedNodeId !== 'root') {
                this.deleteNode(this.selectedNodeId);
            }
        });

        // Export/Import
        document.getElementById('btnExport')?.addEventListener('click', () => this.exportJSON());
        
        const btnImport = document.getElementById('btnImport');
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        
        btnImport?.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.importJSON(e));
        
        // Setup initial helper text
        const instructions = new PIXI.Text('Shift+Drag from a node to create a new branch.\nDrag nodes to move them.', {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xaaaaaa,
            align: 'left'
        });
        instructions.position.set(10, this.app.screen.height - 50);
        this.app.stage.addChild(instructions);
    }

    private renameNode(oldId: string, newId: string) {
        const data = this.nodesData.get(oldId);
        if (!data) return;

        data.id = newId;
        this.nodesData.set(newId, data);
        this.nodesData.delete(oldId);

        const visual = this.visualNodes.get(oldId);
        if (visual) {
            this.visualNodes.set(newId, visual);
            this.visualNodes.delete(oldId);
            // Update text label (assumes it's the second child, graphics is first)
            const textChild = visual.children.find(c => c instanceof PIXI.Text) as PIXI.Text;
            if (textChild) textChild.text = newId;
        }

        // Update connections
        for (const n of this.nodesData.values()) {
            const idx = n.connections.indexOf(oldId);
            if (idx !== -1) {
                n.connections[idx] = newId;
            }
        }
        
        if (this.selectedNodeId === oldId) {
            this.selectedNodeId = newId;
        }
    }

    private deleteNode(nodeId: string) {
        const visual = this.visualNodes.get(nodeId);
        if (visual) {
            visual.destroy();
            this.visualNodes.delete(nodeId);
        }
        this.nodesData.delete(nodeId);

        // Remove from connections
        for (const n of this.nodesData.values()) {
            n.connections = n.connections.filter(id => id !== nodeId);
        }

        this.selectNode(null);
    }

    private showContextPopup(pos: Position) {
        this.ctxPopup.classList.remove('hidden');
        (document.getElementById('nodeId') as HTMLInputElement).value = '';
        (document.getElementById('nodeId') as HTMLInputElement).focus();
    }

    private hideContextPopup() {
        this.ctxPopup.classList.add('hidden');
    }

    private selectNode(nodeId: string | null) {
        this.selectedNodeId = nodeId;
        
        // Highlight logic
        for (const [id, visual] of this.visualNodes.entries()) {
            const bg = visual.children[0] as PIXI.Graphics;
            bg.alpha = (id === nodeId) ? 0.7 : 1.0;
        }

        if (nodeId) {
            const data = this.nodesData.get(nodeId);
            if (data) {
                this.propInspector.classList.remove('hidden');
                (document.getElementById('propId') as HTMLInputElement).value = data.id;
                (document.getElementById('propId') as HTMLInputElement).disabled = data.type === 'root';
                (document.getElementById('propMaxLevel') as HTMLInputElement).value = data.max_level.toString();
                
                const btnDelete = document.getElementById('btnDeleteNode') as HTMLButtonElement;
                if (data.type === 'root') {
                    btnDelete.style.display = 'none';
                } else {
                    btnDelete.style.display = 'block';
                }
            }
        } else {
            this.propInspector.classList.add('hidden');
        }
    }

    private exportJSON() {
        const schema: TalentSchema = {
            nodes: Array.from(this.nodesData.values())
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(schema, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "talents_schema.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    private importJSON(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const result = e.target?.result as string;
                const schema: TalentSchema = JSON.parse(result);
                this.loadSchema(schema);
            } catch (err) {
                alert('Invalid JSON file');
            }
        };
        reader.readAsText(file);
        // Reset input so it can trigger change again
        input.value = '';
    }

    private loadSchema(schema: TalentSchema) {
        // Clear current
        for (const visual of this.visualNodes.values()) {
            visual.destroy();
        }
        this.visualNodes.clear();
        this.nodesData.clear();
        this.selectNode(null);

        // Ensure root exists
        let hasRoot = false;
        for (const n of schema.nodes) {
            if (n.type === 'root' || n.id === 'root') {
                hasRoot = true;
                n.type = 'root'; // enforce
                n.id = 'root';
            }
            this.nodesData.set(n.id, n);
            this.createVisualNode(n);
        }

        if (!hasRoot) {
            this.initRootNode();
        }
    }
}

// Start app
window.onload = () => {
    new TalentEditor();
};
