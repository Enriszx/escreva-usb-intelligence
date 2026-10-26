package br.usbintelligence.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Acesso real a uma pasta escolhida pelo usuário (inclusive a raiz de um
 * pendrive via OTG), usando o Storage Access Framework. O app só alcança
 * a pasta concedida; nada é lido fora dela.
 *
 * Erros são devolvidos como "codigo: mensagem" (conflito, nome, permissao,
 * ausente, falha), que o lado TypeScript converte em FsOpError.
 */
@CapacitorPlugin(name = "UsbiFiles")
public class UsbiFilesPlugin extends Plugin {

    private static final int BUFFER = 1024 * 1024;

    /* ------------------------------------------------------------------ */
    /* Escolha da pasta                                                    */
    /* ------------------------------------------------------------------ */

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "pickFolderResult");
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            call.reject("falha: cancelado pelo usuário");
            return;
        }
        Uri tree = data.getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (SecurityException e) {
            call.reject("permissao: o Android não concedeu acesso persistente a esta pasta.");
            return;
        }
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), tree);
        JSObject ret = new JSObject();
        ret.put("uri", tree.toString());
        ret.put("name", root != null && root.getName() != null ? root.getName() : "Pasta");
        call.resolve(ret);
    }

    @PluginMethod
    public void checkAccess(PluginCall call) {
        String uri = call.getString("uri");
        boolean granted = false;
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().toString().equals(uri) && p.isReadPermission() && p.isWritePermission()) granted = true;
        }
        String name = "";
        if (granted) {
            DocumentFile root = DocumentFile.fromTreeUri(getContext(), Uri.parse(uri));
            granted = root != null && root.exists() && root.canWrite();
            if (root != null && root.getName() != null) name = root.getName();
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        ret.put("name", name);
        call.resolve(ret);
    }

    /* ------------------------------------------------------------------ */
    /* Resolução de caminhos relativos                                     */
    /* ------------------------------------------------------------------ */

    private DocumentFile root(PluginCall call) throws Exception {
        String uri = call.getString("uri");
        if (uri == null) throw new Exception("permissao: pasta não informada.");
        DocumentFile r = DocumentFile.fromTreeUri(getContext(), Uri.parse(uri));
        if (r == null || !r.exists()) throw new Exception("permissao: a pasta não está acessível (pendrive removido?).");
        return r;
    }

    private static String[] split(String path) {
        if (path == null || path.isEmpty()) return new String[0];
        return path.split("/");
    }

    private DocumentFile resolve(DocumentFile root, String path) throws Exception {
        DocumentFile cur = root;
        for (String seg : split(path)) {
            if (seg.isEmpty()) continue;
            DocumentFile next = cur.findFile(seg);
            if (next == null) throw new Exception("ausente: “" + path + "” não existe mais.");
            cur = next;
        }
        return cur;
    }

    private DocumentFile ensureDir(DocumentFile root, String path) throws Exception {
        DocumentFile cur = root;
        for (String seg : split(path)) {
            if (seg.isEmpty()) continue;
            DocumentFile next = cur.findFile(seg);
            if (next == null) {
                next = cur.createDirectory(seg);
                if (next == null) throw new Exception("falha: não foi possível criar a pasta “" + seg + "”.");
            } else if (!next.isDirectory()) {
                throw new Exception("conflito: “" + seg + "” já existe e não é uma pasta.");
            }
            cur = next;
        }
        return cur;
    }

    private static String parentOf(String path) {
        int i = path.lastIndexOf('/');
        return i < 0 ? "" : path.substring(0, i);
    }

    private static String join(String dir, String name) {
        return dir.isEmpty() ? name : dir + "/" + name;
    }

    private static String message(Exception e) {
        String m = e.getMessage();
        if (m == null) m = e.getClass().getSimpleName();
        if (m.matches("^(conflito|nome|permissao|ausente|falha):[\\s\\S]*")) return m;
        if (e instanceof SecurityException) return "permissao: " + m;
        return "falha: " + m;
    }

    /** Executa fora da thread do plugin para operações longas. */
    private void background(PluginCall call, ThrowingRunnable r) {
        getBridge().execute(() -> {
            try {
                r.run();
            } catch (Exception e) {
                call.reject(message(e));
            }
        });
    }

    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    /* ------------------------------------------------------------------ */
    /* Leitura                                                             */
    /* ------------------------------------------------------------------ */

    @PluginMethod
    public void list(PluginCall call) {
        background(call, () -> {
            DocumentFile root = root(call);
            String skip = call.getString("skip", "");
            JSArray files = new JSArray();
            walk(root, "", skip, files);
            JSObject ret = new JSObject();
            ret.put("files", files);
            call.resolve(ret);
        });
    }

    private void walk(DocumentFile dir, String prefix, String skip, JSArray out) {
        for (DocumentFile f : dir.listFiles()) {
            String name = f.getName();
            if (name == null) continue;
            if (prefix.isEmpty() && name.equals(skip)) continue;
            String path = join(prefix, name);
            if (f.isDirectory()) {
                walk(f, path, skip, out);
            } else {
                JSObject o = new JSObject();
                o.put("path", path);
                o.put("name", name);
                o.put("size", f.length());
                o.put("lastModified", f.lastModified());
                o.put("mime", f.getType() != null ? f.getType() : "");
                out.put(o);
            }
        }
    }

    @PluginMethod
    public void exists(PluginCall call) {
        try {
            DocumentFile root = root(call);
            DocumentFile f;
            try {
                f = resolve(root, call.getString("path", ""));
            } catch (Exception e) {
                f = null;
            }
            JSObject ret = new JSObject();
            ret.put("exists", f != null && f.exists());
            ret.put("size", f != null ? f.length() : 0);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(message(e));
        }
    }

    @PluginMethod
    public void sha256(PluginCall call) {
        background(call, () -> {
            String path = call.getString("path", "");
            DocumentFile f = resolve(root(call), path);
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            long done = 0;
            long lastReport = 0;
            try (InputStream in = getContext().getContentResolver().openInputStream(f.getUri())) {
                if (in == null) throw new Exception("falha: não foi possível abrir “" + path + "”.");
                byte[] buf = new byte[BUFFER];
                int n;
                while ((n = in.read(buf)) > 0) {
                    md.update(buf, 0, n);
                    done += n;
                    if (done - lastReport > 8L * BUFFER) {
                        lastReport = done;
                        JSObject p = new JSObject();
                        p.put("path", path);
                        p.put("bytes", done);
                        notifyListeners("hashProgress", p);
                    }
                }
            }
            StringBuilder hex = new StringBuilder();
            for (byte b : md.digest()) hex.append(String.format("%02x", b));
            JSObject ret = new JSObject();
            ret.put("hash", hex.toString());
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void readText(PluginCall call) {
        try {
            DocumentFile f;
            try {
                f = resolve(root(call), call.getString("path", ""));
            } catch (Exception e) {
                JSObject none = new JSObject();
                none.put("text", null);
                call.resolve(none);
                return;
            }
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            try (InputStream in = getContext().getContentResolver().openInputStream(f.getUri())) {
                byte[] buf = new byte[8192];
                int n;
                while (in != null && (n = in.read(buf)) > 0) bos.write(buf, 0, n);
            }
            JSObject ret = new JSObject();
            ret.put("text", new String(bos.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(message(e));
        }
    }

    /* ------------------------------------------------------------------ */
    /* Escrita                                                             */
    /* ------------------------------------------------------------------ */

    @PluginMethod
    public void writeText(PluginCall call) {
        try {
            DocumentFile root = root(call);
            String path = call.getString("path", "");
            DocumentFile dir = ensureDir(root, parentOf(path));
            String name = path.substring(path.lastIndexOf('/') + 1);
            DocumentFile f = dir.findFile(name);
            if (f == null) f = dir.createFile("application/octet-stream", name);
            if (f == null) throw new Exception("falha: não foi possível criar “" + path + "”.");
            try (OutputStream out = getContext().getContentResolver().openOutputStream(f.getUri(), "wt")) {
                if (out == null) throw new Exception("falha: não foi possível gravar “" + path + "”.");
                out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject(message(e));
        }
    }

    @PluginMethod
    public void mkdir(PluginCall call) {
        try {
            ensureDir(root(call), call.getString("path", ""));
            call.resolve();
        } catch (Exception e) {
            call.reject(message(e));
        }
    }

    @PluginMethod
    public void rename(PluginCall call) {
        background(call, () -> {
            DocumentFile root = root(call);
            String path = call.getString("path", "");
            String newName = call.getString("newName", "");
            JSObject ret = new JSObject();
            ret.put("path", renameInternal(root, path, newName));
            call.resolve(ret);
        });
    }

    private String renameInternal(DocumentFile root, String path, String newName) throws Exception {
        DocumentFile f = resolve(root, path);
        String dirPath = parentOf(path);
        DocumentFile dir = resolve(root, dirPath);
        String oldName = f.getName();
        if (newName.equals(oldName)) return path;
        boolean caseOnly = oldName != null && oldName.equalsIgnoreCase(newName);
        if (!caseOnly && dir.findFile(newName) != null) throw new Exception("conflito: já existe “" + newName + "” nesta pasta.");
        if (caseOnly) {
            // FAT32/exFAT não diferenciam maiúsculas: passa por um nome temporário.
            String tmp = newName + ".usbi-tmp-" + System.currentTimeMillis();
            if (!f.renameTo(tmp)) throw new Exception("falha: o Android recusou o novo nome.");
            f = dir.findFile(tmp);
            if (f == null) throw new Exception("falha: arquivo sumiu durante a troca de nome.");
        }
        if (!f.renameTo(newName)) throw new Exception("falha: o Android recusou o novo nome.");
        // Alguns provedores ajustam o nome ("a (1).txt"): devolve o que de fato ficou.
        String finalName = f.getName() != null ? f.getName() : newName;
        return join(dirPath, finalName);
    }

    @PluginMethod
    public void move(PluginCall call) {
        background(call, () -> {
            DocumentFile root = root(call);
            String path = call.getString("path", "");
            String destDir = call.getString("destDir", "");
            String newName = call.getString("newName", "");
            String srcDirPath = parentOf(path);
            if (srcDirPath.equals(destDir)) {
                JSObject ret = new JSObject();
                ret.put("path", renameInternal(root, path, newName));
                call.resolve(ret);
                return;
            }
            DocumentFile src = resolve(root, path);
            DocumentFile srcDir = resolve(root, srcDirPath);
            DocumentFile dest = ensureDir(root, destDir);
            if (dest.findFile(newName) != null) throw new Exception("conflito: já existe “" + newName + "” em “" + (destDir.isEmpty() ? "raiz" : destDir) + "”.");

            ContentResolver cr = getContext().getContentResolver();
            String oldName = src.getName();
            boolean moved = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                try {
                    Uri out = DocumentsContract.moveDocument(cr, src.getUri(), srcDir.getUri(), dest.getUri());
                    if (out != null) {
                        moved = true;
                        if (!newName.equals(oldName)) {
                            DocumentFile m = dest.findFile(oldName);
                            if (m == null || !m.renameTo(newName)) throw new Exception("falha: movido, mas não foi possível renomear para “" + newName + "”.");
                        }
                    }
                } catch (UnsupportedOperationException | IllegalArgumentException ignored) {
                    // provedor sem suporte a mover: cai para copiar + apagar
                }
            }
            if (!moved) {
                DocumentFile copy = dest.createFile(src.getType() != null ? src.getType() : "application/octet-stream", newName);
                if (copy == null) throw new Exception("falha: não foi possível criar a cópia no destino.");
                long written = 0;
                try (InputStream in = cr.openInputStream(src.getUri()); OutputStream out = cr.openOutputStream(copy.getUri(), "w")) {
                    if (in == null || out == null) throw new Exception("falha: não foi possível abrir os arquivos.");
                    byte[] buf = new byte[BUFFER];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        written += n;
                    }
                }
                // Só apaga a origem se a cópia está completa.
                if (written != src.length()) {
                    copy.delete();
                    throw new Exception("falha: cópia incompleta; o original foi mantido.");
                }
                if (!src.delete()) throw new Exception("falha: copiado, mas a origem não pôde ser apagada.");
            }
            DocumentFile placed = dest.findFile(newName);
            JSObject ret = new JSObject();
            ret.put("path", join(destDir, placed != null && placed.getName() != null ? placed.getName() : newName));
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        background(call, () -> {
            DocumentFile f = resolve(root(call), call.getString("path", ""));
            if (f.isDirectory() && f.listFiles().length > 0 && !call.getBoolean("recursive", false)) {
                throw new Exception("falha: a pasta não está vazia.");
            }
            if (!f.delete()) throw new Exception("falha: o Android não conseguiu apagar o item.");
            call.resolve();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Exportação ("Salvar como…" nativo)                                  */
    /* ------------------------------------------------------------------ */

    private byte[] pendingBytes;

    @PluginMethod
    public void saveFile(PluginCall call) {
        String b64 = call.getString("base64", "");
        pendingBytes = Base64.decode(b64, Base64.DEFAULT);
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "arquivo"));
        startActivityForResult(call, intent, "saveFileResult");
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) {
            pendingBytes = null;
            JSObject r = new JSObject();
            r.put("saved", false);
            call.resolve(r);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(data.getData(), "w")) {
            if (out == null) throw new Exception("falha: destino indisponível.");
            out.write(pendingBytes);
            JSObject r = new JSObject();
            r.put("saved", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(message(e));
        } finally {
            pendingBytes = null;
        }
    }
}
