all:add commit pull push

add:
	git add -A
commit:
	git commit -m “updated”
pull:
	git pull origin master
push:
	git push origin master