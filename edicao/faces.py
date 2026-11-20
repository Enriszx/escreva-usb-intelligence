import cv2, json
cap=cv2.VideoCapture("bruto_1080.mp4"); W,H=1920,1080
det=cv2.FaceDetectorYN.create("models/yunet.onnx","",(960,540),0.6)
out=[]; i=0
while True:
    ok,f=cap.read()
    if not ok: break
    if i%3==0:
        s=cv2.resize(f,(960,540)); _,r=det.detect(s)
        if r is not None and len(r):
            b=max(r,key=lambda x:x[2]*x[3]); x,y,w,h=[float(v) for v in b[:4]*2]
            out.append({"t":round(i/30,2),"cx":round((x+w/2)/W,3),"cy":round((y+h/2)/H,3),"w":round(w/W,3),"h":round(h/H,3)})
        else: out.append({"t":round(i/30,2)})
    i+=1
json.dump(out,open("faces.json","w"))
