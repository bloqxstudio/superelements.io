import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  useWorkspaces,
  useWorkspaceMembers,
  useAllUsers,
  useCreateWorkspace,
  useDeleteWorkspace,
  useAddWorkspaceMemberByEmail,
  useRemoveWorkspaceMember,
} from '@/hooks/useWorkspaceManagement';
import { Search, Plus, Trash2, Users, Building2, LogIn } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WorkspacesPage = () => {
  const navigate = useNavigate();
  const { enterWorkspace } = useWorkspace();
  const { data: workspaces, isLoading } = useWorkspaces();
  const { data: allUsers } = useAllUsers();
  const createWorkspace = useCreateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const addMember = useAddWorkspaceMemberByEmail();
  const removeMember = useRemoveWorkspaceMember();

  const [searchQuery, setSearchQuery] = useState('');

  // Create workspace dialog
  const [createDialog, setCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOwnerId, setNewOwnerId] = useState('');

  // Members dialog
  const [membersDialog, setMembersDialog] = useState<{ open: boolean; workspaceId: string | null; workspaceName: string }>({
    open: false,
    workspaceId: null,
    workspaceName: '',
  });
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'owner' | 'member' | 'manager'>('member');

  const { data: members } = useWorkspaceMembers(membersDialog.workspaceId);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; workspaceId: string; workspaceName: string } | null>(null);

  const filteredWorkspaces = (workspaces ?? []).filter((ws) =>
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.owner_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (!newName.trim() || !newOwnerId) return;
    createWorkspace.mutate(
      { name: newName.trim(), owner_id: newOwnerId },
      {
        onSuccess: () => {
          setCreateDialog(false);
          setNewName('');
          setNewOwnerId('');
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteDialog) return;
    deleteWorkspace.mutate(deleteDialog.workspaceId, {
      onSuccess: () => setDeleteDialog(null),
    });
  };

  const handleAddMember = () => {
    if (!addMemberEmail.trim() || !membersDialog.workspaceId) return;
    addMember.mutate(
      { workspace_id: membersDialog.workspaceId, email: addMemberEmail.trim().toLowerCase(), role: addMemberRole },
      {
        onSuccess: () => {
          setAddMemberEmail('');
          setAddMemberRole('member');
        },
      }
    );
  };

  const handleRemoveMember = (userId: string) => {
    if (!membersDialog.workspaceId) return;
    removeMember.mutate({ workspace_id: membersDialog.workspaceId, user_id: userId });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os workspaces da plataforma e seus membros
          </p>
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Workspace
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{workspaces?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total de workspaces</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">
                {workspaces?.reduce((acc, ws) => acc + ws.member_count, 0) ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Total de membros</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">
                {workspaces?.reduce((acc, ws) => acc + ws.connection_count, 0) ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Total de conexões</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, slug ou owner..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-center">Membros</TableHead>
                <TableHead className="text-center">Conexões</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredWorkspaces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum workspace encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkspaces.map((ws) => (
                  <TableRow key={ws.id}>
                    <TableCell className="font-medium">{ws.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{ws.slug}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ws.owner_email}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{ws.member_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{ws.connection_count}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ws.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            enterWorkspace({
                              id: ws.id,
                              name: ws.name,
                              slug: ws.slug,
                              role: 'owner',
                            });
                            navigate('/inicio');
                          }}
                        >
                          <LogIn className="h-4 w-4 mr-1" />
                          Entrar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setMembersDialog({ open: true, workspaceId: ws.id, workspaceName: ws.name })
                          }
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Membros
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteDialog({ open: true, workspaceId: ws.id, workspaceName: ws.name })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Workspace Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Workspace</DialogTitle>
            <DialogDescription>
              Crie um novo workspace para um webdesigner ou agência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="ws-name">Nome do workspace</Label>
              <Input
                id="ws-name"
                placeholder="Ex: Studio Igor Design"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ws-owner">Owner (webdesigner)</Label>
              <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                <SelectTrigger id="ws-owner">
                  <SelectValue placeholder="Selecione o owner" />
                </SelectTrigger>
                <SelectContent>
                  {(allUsers ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || !newOwnerId || createWorkspace.isPending}
            >
              {createWorkspace.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog
        open={membersDialog.open}
        onOpenChange={(open) => setMembersDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Membros — {membersDialog.workspaceName}</DialogTitle>
            <DialogDescription>Gerencie os membros deste workspace.</DialogDescription>
          </DialogHeader>

          {/* Add member form */}
          <div className="flex items-end gap-2 py-2">
            <div className="flex-1 space-y-1">
              <Label>Email do usuário</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={addMemberEmail}
                onChange={(e) => setAddMemberEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              />
            </div>
            <div className="w-36 space-y-1">
              <Label>Role</Label>
              <Select value={addMemberRole} onValueChange={(v) => setAddMemberRole(v as 'owner' | 'member' | 'manager')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Gestor</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddMember}
              disabled={!addMemberEmail.trim() || addMember.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {/* Members list */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(members ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                    Nenhum membro
                  </TableCell>
                </TableRow>
              ) : (
                (members ?? []).map((m) => (
                  <TableRow key={m.user_id}>
                    <TableCell className="text-sm">{m.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={m.role === 'owner' ? 'default' : 'secondary'}
                        className={(m.role as string) === 'manager' ? 'bg-violet-100 text-violet-700 hover:bg-violet-100' : ''}
                      >
                        {(m.role as string) === 'manager' ? 'gestor' : m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(m.joined_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveMember(m.user_id)}
                        disabled={removeMember.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersDialog((prev) => ({ ...prev, open: false }))}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir workspace</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteDialog?.workspaceName}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteWorkspace.isPending}
            >
              {deleteWorkspace.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkspacesPage;
